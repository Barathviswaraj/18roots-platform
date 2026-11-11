class CarePlan < ApplicationRecord
  belongs_to :patient, class_name: "User"
  belongs_to :doctor
  has_many :doses, -> { order(:position, :time_of_day) }, class_name: "CareDose", dependent: :destroy
  has_many :goals, -> { order(:position) }, class_name: "CareGoal", dependent: :destroy
  has_many :notes, -> { order(shared_at: :desc) }, class_name: "CareNote", dependent: :destroy
end
