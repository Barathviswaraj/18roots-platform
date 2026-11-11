# Hourly cleanup so tables stay small. Failed outbox messages are kept until
# someone looks at them.
class PurgeExpiredRecordsJob < ApplicationJob
  queue_as :default

  WEBHOOK_EVENT_RETENTION = 90.days
  DELIVERED_OUTBOX_RETENTION = 30.days

  def perform
    IdempotencyKey.expired.in_batches(of: 500).delete_all
    WebhookEvent.where(created_at: ...WEBHOOK_EVENT_RETENTION.ago).in_batches(of: 500).delete_all
    OutboxMessage.where(completed_at: ...DELIVERED_OUTBOX_RETENTION.ago).in_batches(of: 500).delete_all
  end
end
