class OtpChallenge < ApplicationRecord
  MAX_ATTEMPTS = 5

  scope :live, -> { where(consumed_at: nil).where(expires_at: Time.current..) }

  def expired?
    expires_at <= Time.current
  end

  def usable?
    consumed_at.nil? && !expired? && attempts < MAX_ATTEMPTS
  end
end
