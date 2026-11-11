class AvailabilityRule < ApplicationRecord
  belongs_to :doctor

  validates :weekday, inclusion: { in: 0..6 }
  validates :start_minute, :end_minute, numericality: { in: 0..1440 }
end
