class OutboxMessage < ApplicationRecord
  TOPICS = %w[meeting_create meeting_cancel payment_refund].freeze

  validates :topic, inclusion: { in: TOPICS }

  before_validation { self.next_attempt_at ||= Time.current }
  after_create_commit :dispatch_soon

  scope :pending, -> { where(completed_at: nil, failed_at: nil) }
  scope :due, -> { pending.where(next_attempt_at: ..Time.current) }

  private

  # The change is already saved: if the queue store is down, the recurring
  # sweep delivers the message once it is back.
  def dispatch_soon
    OutboxDispatchJob.perform_later
  rescue StandardError => error
    Rails.logger.warn("[outbox] could not queue delivery of #{id}, the recurring sweep will: #{error.class}")
  end
end
