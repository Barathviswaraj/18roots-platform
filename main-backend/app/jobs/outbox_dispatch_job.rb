# Delivers calls to other services saved in the outbox: creating and cancelling
# meetings, and starting refunds. Runs after each new message and every minute.
class OutboxDispatchJob < ApplicationJob
  queue_as :critical

  BATCH_SIZE = 50
  LEASE = 2.minutes
  MAX_ATTEMPTS = 24
  MAX_BACKOFF = 1.hour

  def perform(meetings: nil)
    @meetings = meetings
    loop do
      batch = claim_batch
      batch.each { |message| process(message) }
      break if batch.size < BATCH_SIZE
    end
  end

  private

  def meetings
    @meetings ||= Meetings::Client.new
  end

  def claim_batch
    OutboxMessage.transaction do
      batch = OutboxMessage.due.order(:next_attempt_at).limit(BATCH_SIZE).lock("FOR UPDATE SKIP LOCKED").to_a
      OutboxMessage.where(id: batch.map(&:id)).update_all(next_attempt_at: LEASE.from_now) if batch.any?
      batch
    end
  end

  def process(message)
    note = case message.topic
           when "meeting_create" then create_meeting(message.payload.fetch("appointment_id"))
           when "meeting_cancel" then cancel_meeting(message.payload.fetch("appointment_id"))
           when "payment_refund" then refund(message.payload.fetch("payment_id"))
           end
    message.update_columns(completed_at: Time.current, attempts: message.attempts + 1, last_error: note, updated_at: Time.current)
  rescue StandardError => error
    record_failure(message, error)
  end

  def create_meeting(appointment_id)
    return "skipped: MEETING_SERVICE_URL is not set" unless @meetings || Meetings::Client.configured?

    appointment = Appointment.includes(:doctor, :patient).find(appointment_id)
    return "skipped: appointment is #{appointment.status}" unless appointment.status == "confirmed"
    return nil if appointment.meeting_id

    meeting_id = meetings.create_meeting(appointment)
    Appointment.where(id: appointment.id, meeting_id: nil).update_all(meeting_id:, consultation_status: "scheduled", updated_at: Time.current)
    nil
  end

  def cancel_meeting(appointment_id)
    appointment = Appointment.find(appointment_id)
    return "skipped: no meeting" unless appointment.meeting_id
    return "skipped: MEETING_SERVICE_URL is not set" unless @meetings || Meetings::Client.configured?

    meetings.cancel_meeting(appointment.meeting_id)
    nil
  end

  def refund(payment_id)
    payment = Payment.find(payment_id)
    return nil if payment.status == "refunded"

    Scheduling::Refunds.completed!(payment) if Payments::Gateway.refund(payment) == :refunded
    nil
  end

  def record_failure(message, error)
    attempts = message.attempts + 1
    details = "#{error.class}: #{error.message}".truncate(500)
    if attempts >= MAX_ATTEMPTS
      message.update_columns(failed_at: Time.current, attempts:, last_error: details, updated_at: Time.current)
      Rails.logger.error("[outbox] gave up on #{message.topic} #{message.id} after #{attempts} attempts: #{details}")
    else
      backoff = [(2**attempts) * 15, MAX_BACKOFF.to_i].min.seconds
      message.update_columns(next_attempt_at: backoff.from_now, attempts:, last_error: details, updated_at: Time.current)
      Rails.logger.warn("[outbox] #{message.topic} #{message.id} attempt #{attempts} failed, retrying in #{backoff.to_i}s: #{details}")
    end
  end
end
