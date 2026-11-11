class Appointment < ApplicationRecord
  class InvalidTransition < StandardError; end

  HOLD_MINUTES = 15
  # 15 minutes normally. A test server can open Join earlier (render.yaml sets
  # a day) so a booked call can be tried at once.
  JOIN_OPENS_BEFORE = ENV.fetch("JOIN_OPENS_MINUTES_BEFORE", "15").to_i.minutes
  FREE_CANCELLATION_BEFORE = 6.hours
  ACTIVE_STATUSES = %w[held confirmed completed].freeze
  TRANSITIONS = {
    "held" => %w[confirmed expired cancelled],
    "confirmed" => %w[completed missed cancelled],
    "completed" => [],
    "missed" => [],
    "cancelled" => [],
    "expired" => []
  }.freeze

  belongs_to :patient, class_name: "User"
  belongs_to :doctor
  has_one :payment, dependent: :restrict_with_exception
  has_many :care_notes, dependent: :nullify

  scope :visible, -> { where(status: %w[held confirmed completed missed cancelled]) }

  validates :status, inclusion: { in: TRANSITIONS.keys }
  validates :reason, length: { maximum: 500 }, allow_nil: true
  validate :status_change_allowed, if: -> { persisted? && will_save_change_to_status? }

  def transition_to!(target, **attributes)
    target = target.to_s
    raise InvalidTransition, "#{status} cannot become #{target}" unless TRANSITIONS.fetch(status).include?(target)

    update!(attributes.merge(status: target))
  end

  # A lapsed hold frees the slot, and its unpaid payment can no longer succeed.
  def expire_hold!
    transition_to!("expired")
    payment.update!(status: "failed") if payment&.status == "created"
  end

  def hold_expired?(now = Time.current)
    status == "held" && hold_expires_at.present? && hold_expires_at <= now
  end

  def join_opens_at
    starts_at - JOIN_OPENS_BEFORE
  end

  def patient_can_cancel?(now = Time.current)
    status == "confirmed" && consultation_status != "in_progress" && starts_at - now > FREE_CANCELLATION_BEFORE
  end

  # The single status the app shows, combining appointment and consultation.
  def app_status(now = Time.current)
    case status
    when "held" then "pending_payment"
    when "completed" then "completed"
    when "missed", "expired" then "missed"
    when "cancelled" then "cancelled"
    else
      return "in_progress" if consultation_status == "in_progress"
      return "missed" if now > ends_at

      "confirmed"
    end
  end

  private

  def status_change_allowed
    from = status_in_database
    return if from.nil? || TRANSITIONS.fetch(from, []).include?(status)

    errors.add(:status, "cannot change from #{from} to #{status}")
  end
end
