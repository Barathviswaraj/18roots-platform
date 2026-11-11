module Scheduling
  # Patient cancellations follow the policy shown before payment: free up to six
  # hours before the start. The refund and the meeting cancellation go through
  # the outbox, so they are retried until they succeed.
  class Cancellations
    class NotAllowed < StandardError; end

    def self.by_patient!(appointment, patient:, now: Time.current)
      Appointment.transaction do
        appointment.lock!
        return appointment if appointment.status == "cancelled"
        raise NotAllowed, "This consultation can no longer be cancelled in the app" unless appointment.patient_can_cancel?(now)

        cancel!(appointment, by: "patient", refund_amount: appointment.payment&.amount.to_i, actor: patient)
      end
    end

    def self.cancel!(appointment, by:, refund_amount:, actor: nil)
      appointment.transition_to!("cancelled", cancelled_at: Time.current, cancelled_by: by)
      payment = appointment.payment
      Refunds.start!(payment, amount: refund_amount, reason: "cancelled_by_#{by}") if payment&.status == "paid" && refund_amount.positive?
      OutboxMessage.create!(topic: "meeting_cancel", payload: { appointment_id: appointment.id }) if appointment.meeting_id
      Notification.create!(
        user: appointment.patient,
        title: "Consultation cancelled",
        body: refund_amount.positive? ? "Your refund has been started." : "Your consultation was cancelled.",
        link: "/consultations/#{appointment.id}"
      )
      AuditEvent.record!(action: "appointment.cancelled", actor:, subject: appointment, metadata: { by:, refund_amount: })
      appointment
    end
  end
end
