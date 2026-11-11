class WebhookEvent < ApplicationRecord
  # Uniqueness is left to the database index. The webhook controller relies on
  # RecordNotUnique to answer duplicates with 200 instead of an error.
  validates :event_id, presence: true, length: { maximum: 160 }
  validates :event_name, presence: true, length: { maximum: 80 }
end

