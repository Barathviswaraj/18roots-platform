class CareNote < ApplicationRecord
  belongs_to :care_plan, optional: true
  belongs_to :appointment, optional: true
end
