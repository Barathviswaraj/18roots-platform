class Meeting < ApplicationRecord
  class InvalidTransition < StandardError; end

  STATUSES = %w[scheduled ready in_progress ended cancelled failed].freeze
  TRANSITIONS = {
    "scheduled" => %w[ready in_progress ended cancelled failed],
    "ready" => %w[in_progress ended cancelled failed],
    "in_progress" => %w[ended cancelled failed],
    "ended" => [],
    "cancelled" => [],
    "failed" => []
  }.freeze

  has_many :participants, dependent: :destroy
  has_many :webhook_events, primary_key: :room_name, foreign_key: :room_name, inverse_of: false

  enum :meeting_type, { one_to_one: "one_to_one" }
  enum :status, STATUSES.index_with(&:itself), default: "scheduled"

  validates :external_appointment_reference, presence: true, length: { maximum: 160 }
  validates :room_name, presence: true, length: { maximum: 128 }, uniqueness: true
  validates :meeting_type, inclusion: { in: ["one_to_one"] }
  validates :status, inclusion: { in: STATUSES }
  validate :status_transition_must_be_allowed, if: :will_save_change_to_status?

  before_validation :assign_room_name, on: :create

  def transition_to!(target_status)
    target_status = target_status.to_s
    return self if target_status == status

    unless TRANSITIONS.fetch(status, []).include?(target_status)
      raise InvalidTransition, "cannot transition from #{status} to #{target_status}"
    end

    update!(status: target_status)
    self
  end

  def terminal?
    ended? || cancelled? || failed?
  end

  private

  def assign_room_name
    self.room_name ||= "18roots-#{SecureRandom.uuid.delete('-')}"
  end

  def status_transition_must_be_allowed
    previous_status = status_in_database
    return if previous_status.nil? || previous_status == status

    return if TRANSITIONS.fetch(previous_status, []).include?(status)

    errors.add(:status, "cannot transition from #{previous_status} to #{status}")
  end
end

