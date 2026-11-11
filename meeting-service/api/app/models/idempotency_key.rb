class IdempotencyKey < ApplicationRecord
  validates :scope, :key_digest, :request_digest, :expires_at, presence: true
  validates :key_digest, :request_digest, length: { is: 64 }

  scope :expired, -> { where(expires_at: ...Time.current) }
end

