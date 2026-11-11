class OutboxMessage < ApplicationRecord
  TOPICS = %w[meeting_event livekit_room_cleanup].freeze

  validates :topic, inclusion: { in: TOPICS }
  validates :next_attempt_at, presence: true

  before_validation { self.next_attempt_at ||= Time.current }
  after_create_commit :dispatch_soon

  scope :pending, -> { where(completed_at: nil, failed_at: nil) }
  scope :due, -> { pending.where(next_attempt_at: ..Time.current) }

  def self.enqueue_room_cleanup!(room_name)
    create!(topic: "livekit_room_cleanup", payload: { room_name: })
  end

  private

  # Deliver soon after commit. If the queue store is down, the change is
  # already saved, so the request must still succeed: the recurring sweep
  # delivers the message once the store is back.
  def dispatch_soon
    OutboxDispatchJob.perform_later
  rescue StandardError => error
    Rails.logger.warn("[outbox] could not queue delivery of #{id}, the recurring sweep will: #{error.class}: #{error.message}")
  end
end
