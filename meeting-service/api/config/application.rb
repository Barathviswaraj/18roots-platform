require_relative "boot"
require "rails"
# Only what this API uses. "rails/all" also loads Active Storage, which stops
# production from starting when config/storage.yml does not exist.
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"

Bundler.require(*Rails.groups)

module MeetingService
  class Application < Rails::Application
    config.load_defaults 8.1
    config.api_only = true
    config.active_job.queue_adapter = :sidekiq
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc
    config.filter_parameters += %i[authorization token access_token api_secret platform_jwt_secret]

    config.middleware.insert_before 0, Rack::Attack
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins(*ENV.fetch("CORS_ORIGINS", "http://localhost:8081").split(",").map(&:strip))
        resource "*", headers: :any, methods: %i[get post options], max_age: 600
      end
    end
  end
end

