class RefreshToken < ApplicationRecord
  belongs_to :user

  def active?
    revoked_at.nil? && used_at.nil? && expires_at > Time.current
  end
end
