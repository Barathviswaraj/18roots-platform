class Doctor < ApplicationRecord
  belongs_to :user, optional: true
  has_many :availability_rules, dependent: :delete_all
  has_many :appointments, dependent: :restrict_with_exception

  scope :active, -> { where(active: true) }

  validates :name, :title, :registration_number, :cancellation_policy, presence: true
  validates :fee_amount, numericality: { greater_than_or_equal_to: 0 }
  validates :consultation_minutes, numericality: { in: 10..120 }

  def verified?
    verified_at.present?
  end

  # The ID the meeting service knows this doctor by. A doctor who signs in to
  # the doctor portal uses their user ID, which their login token carries.
  def meeting_reference
    user_id || "doctor-#{id}"
  end
end
