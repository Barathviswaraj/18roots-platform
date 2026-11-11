# Delivers due outbox messages. Runs after each new message is committed and
# every minute from RecurringJobScheduler. Several copies can run at once:
# each claims different rows with SKIP LOCKED and a short lease.
class OutboxDispatchJob < ApplicationJob
  queue_as :critical

  BATCH_SIZE = 50
  LEASE = 2.minutes
  # 24 attempts with the backoff below spread retries over about a day.
  MAX_ATTEMPTS = 24
  MAX_BACKOFF = 1.hour

  def perform(event_delivery: EventWebhookDelivery.new, room_service: LivekitRoomService.new)
    @event_delivery = event_delivery
    @room_service = room_service

    loop do
      batch = claim_batch
      batch.each { |message| process(message) }
      break if batch.size < BATCH_SIZE
    end
  end

  private

  # Claims rows by pushing their next attempt past the lease, so a crashed
  # worker's rows become due again instead of being stuck.
  def claim_batch
    OutboxMessage.transaction do
      batch = OutboxMessage.due.order(:next_attempt_at).limit(BATCH_SIZE).lock("FOR UPDATE SKIP LOCKED").to_a
      OutboxMessage.where(id: batch.map(&:id)).update_all(next_attempt_at: LEASE.from_now) if batch.any?
      batch
    end
  end

  def process(message)
    case message.topic
    when "meeting_event" then deliver_event(message)
    when "livekit_room_cleanup" then delete_room(message)
    end
    message.update_columns(completed_at: Time.current, attempts: message.attempts + 1, last_error: nil, updated_at: Time.current)
  rescue StandardError => error
    record_failure(message, error)
  end

  def deliver_event(message)
    return unless @event_delivery.configured?

    body = { id: message.id }.merge(message.payload.symbolize_keys).to_json
    @event_delivery.deliver(event_id: message.id, body:)
  end

  def delete_room(message)
    @room_service.delete_room(message.payload.fetch("room_name"))
  rescue LiveKit::ServerError => error
    raise unless error.code.to_s == "not_found"
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
