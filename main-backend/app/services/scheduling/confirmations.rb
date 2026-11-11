module Scheduling
  # Marks a payment paid and confirms its appointment. Safe to call more than
  # once (a provider can send the same event twice). The video meeting is then
  # created through the outbox, so a meeting service outage cannot lose it.
  class Confirmations
    def self.payment_succeeded!(payment, provider_payment_id: nil, now: Time.current)
      Appointment.transaction do
        payment.lock!
        appointment = payment.appointment.lock!
        return appointment if payment.status == "paid"

        payment.update!(status: "paid", paid_at: now, provider_payment_id: provider_payment_id || payment.provider_payment_id)

        if appointment.status == "held"
          appointment.transition_to!("confirmed", hold_expires_at: nil)
          OutboxMessage.create!(topic: "meeting_create", payload: { appointment_id: appointment.id })
          Notification.create!(
            user: appointment.patient,
            title: "Consultation booked",
            body: "Your consultation with #{appointment.doctor.name} is confirmed.",
            link: "/consultations/#{appointment.id}"
          )
          AuditEvent.record!(action: "appointment.confirmed", actor: appointment.patient, subject: appointment)
        else
          # Paid after the hold lapsed and the slot went to someone else:
          # refund in full and let support follow up.
          Refunds.start!(payment, amount: payment.amount, reason: "late_payment")
          appointment.update!(needs_review: true)
        end
        appointment
      end
    end

    def self.payment_failed!(payment)
      Appointment.transaction do
        payment.lock!
        return if payment.status != "created"

        payment.update!(status: "failed")
        appointment = payment.appointment.lock!
        appointment.transition_to!("expired") if appointment.status == "held"
      end
    end
  end
end
