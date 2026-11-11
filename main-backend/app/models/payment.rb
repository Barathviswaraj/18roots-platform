class Payment < ApplicationRecord
  belongs_to :appointment
  belongs_to :patient, class_name: "User"

  validates :status, inclusion: { in: %w[created paid failed refund_pending refunded] }
  validates :provider, inclusion: { in: %w[demo payment_service] }
  validates :amount, numericality: { greater_than_or_equal_to: 0 }
end
