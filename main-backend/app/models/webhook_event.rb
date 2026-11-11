class WebhookEvent < ApplicationRecord
  # Uniqueness is left to the database index: a duplicate raises
  # RecordNotUnique, which the webhook controllers answer with 200.
end
