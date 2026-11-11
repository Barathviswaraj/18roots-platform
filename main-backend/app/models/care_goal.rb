class CareGoal < ApplicationRecord
  belongs_to :care_plan
  has_many :logs, class_name: "GoalLog", dependent: :delete_all
end
