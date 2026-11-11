class Order < ApplicationRecord
  STATUSES = %w[placed packed shipped out_for_delivery delivered cancelled].freeze
  TRACKED_STEPS = %w[placed packed shipped out_for_delivery delivered].freeze

  belongs_to :patient, class_name: "User"
  has_many :items, class_name: "OrderItem", dependent: :delete_all
  has_many :events, -> { order(:at) }, class_name: "OrderEvent", dependent: :delete_all

  scope :active, -> { where.not(status: %w[delivered cancelled]) }

  validates :status, inclusion: { in: STATUSES }
end
