class CareDose < ApplicationRecord
  belongs_to :care_plan
  has_many :logs, class_name: "DoseLog", dependent: :delete_all

  validates :slot, inclusion: { in: %w[morning afternoon night] }
  validates :time_of_day, format: { with: /\A([01]\d|2[0-3]):[0-5]\d\z/ }
end
