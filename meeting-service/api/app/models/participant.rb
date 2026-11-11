class Participant < ApplicationRecord
  belongs_to :meeting, inverse_of: :participants
  enum :role, { doctor: "doctor", patient: "patient" }

  validates :role, inclusion: { in: %w[doctor patient] }
  validates :external_user_reference, presence: true, length: { maximum: 160 }
  validates :livekit_identity, presence: true, length: { maximum: 128 }, uniqueness: true
  validates :display_name, length: { maximum: 120 }, allow_blank: true
  validates :role, uniqueness: { scope: :meeting_id }
  validates :external_user_reference, uniqueness: { scope: :meeting_id }

  before_validation :assign_livekit_identity, on: :create

  private

  def assign_livekit_identity
    self.livekit_identity ||= SecureRandom.uuid
  end
end

