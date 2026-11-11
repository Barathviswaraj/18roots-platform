module Scheduling
  # Books a consultation: rechecks the slot, holds it for HOLD_MINUTES inside a
  # transaction, and creates a payment order. The unique index on
  # (doctor_id, starts_at) stops two patients holding the same time, even if
  # their requests arrive together. The same Idempotency-Key returns the same
  # booking, so a double tap or a retry never books or charges twice.
  class Bookings
    class Error < StandardError
      attr_reader :code, :status

      def initialize(code, message, status: 422)
        @code = code
        @status = status
        super(message)
      end
    end

    CONSENT_VERSION = "2026-11"

    def self.create!(patient:, doctor_id:, slot_id:, reason:, consent:, idempotency_key:, now: Time.current)
      unless idempotency_key.to_s.match?(/\A[A-Za-z0-9._:-]{16,128}\z/)
        raise Error.new("idempotency_key_required", "Provide a valid Idempotency-Key header", status: 400)
      end

      existing = Payment.find_by(patient:, idempotency_key:)
      return ensure_order!(existing) if existing

      raise Error.new("consent_required", "Please accept the consultation terms") unless consent == true

      doctor = Doctor.active.find_by(id: doctor_id)
      raise Error.new("not_found", "Doctor not found", status: 404) unless doctor

      slot_doctor_id, starts_at = Slots.parse_id(slot_id)
      unless slot_doctor_id == doctor.id && starts_at && Slots.bookable?(doctor, starts_at, now:)
        raise Error.new("slot_unavailable", "That time is no longer available", status: 409)
      end

      appointment = nil
      Appointment.transaction do
        # Release expired holds on this slot so the unique index lets us in.
        doctor.appointments.where(starts_at:, status: "held").where(hold_expires_at: ..now).find_each(&:expire_hold!)

        appointment = Appointment.create!(
          patient:, doctor:, starts_at:, ends_at: starts_at + doctor.consultation_minutes.minutes,
          status: "held", hold_expires_at: now + Appointment::HOLD_MINUTES.minutes,
          reason: reason.to_s.strip.presence&.truncate(500),
          consent_accepted_at: now, consent_version: CONSENT_VERSION
        )
        Payment.create!(
          appointment:, patient:, idempotency_key:, amount: doctor.fee_amount,
          provider: Payments::Gateway.provider == "payment_service" ? "payment_service" : "demo"
        )
        AuditEvent.record!(action: "appointment.held", actor: patient, subject: appointment,
                           metadata: { doctor_id: doctor.id, starts_at: starts_at.iso8601 })
      end
      ensure_order!(appointment.payment)
    rescue ActiveRecord::RecordNotUnique
      # Either the slot was taken a moment ago, or this same key was used by a
      # parallel request: return that booking if so.
      existing = Payment.find_by(patient:, idempotency_key:)
      return ensure_order!(existing) if existing

      raise Error.new("slot_unavailable", "That time is no longer available", status: 409)
    end

    # Creates the payment order after the hold is committed, so a slow payment
    # provider never holds database locks. A retry with the same key resumes
    # here if the first attempt failed before the order existed.
    def self.ensure_order!(payment)
      if payment.provider_order_id.blank? && payment.status == "created"
        order = Payments::Gateway.create_order(payment)
        payment.update!(provider_order_id: order.provider_order_id, checkout_url: order.checkout_url)
      end
      payment.appointment
    end
  end
end
