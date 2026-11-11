ENV["RAILS_ENV"] ||= "test"
ENV["ALLOW_DEMO_AUTH"] = "true"
ENV["LIVEKIT_API_KEY"] ||= "devkey"
ENV["LIVEKIT_API_SECRET"] ||= "secret"
ENV["LIVEKIT_API_URL"] ||= "http://localhost:7880"
ENV["LIVEKIT_PUBLIC_URL"] ||= "ws://localhost:7880"
ENV["REDIS_URL"] ||= "redis://localhost:6379/0"
# The demo client creates meetings as the doctor; production default is service only.
ENV["MEETING_CREATOR_ROLES"] ||= "service,doctor"

require_relative "../config/environment"
abort("The RSpec suite must not run in production") if Rails.env.production?
require "rspec/rails"

module SpecHelpers
  PLATFORM_SECRET = "spec-platform-secret-0123456789abcdef0123456789".freeze

  # Sets environment variables for the block, then restores them.
  def with_env(values)
    previous = values.keys.to_h { |name| [name, ENV[name]] }
    values.each { |name, value| value.nil? ? ENV.delete(name) : ENV[name] = value }
    yield
  ensure
    previous.each { |name, value| value.nil? ? ENV.delete(name) : ENV[name] = value }
  end

  # Signed platform tokens instead of demo headers, as in production.
  def with_platform_tokens(&block)
    with_env(
      "ALLOW_DEMO_AUTH" => "false",
      "PLATFORM_JWT_SECRET" => PLATFORM_SECRET,
      "PLATFORM_JWT_PREVIOUS_SECRET" => nil,
      "PLATFORM_JWT_PUBLIC_KEY" => nil,
      "PLATFORM_JWT_ISSUER" => "18roots-main-app",
      "PLATFORM_JWT_AUDIENCE" => "18roots-meeting-service",
      &block
    )
  end

  def platform_token(role:, sub:, key: PLATFORM_SECRET, algorithm: "HS256", **claims)
    payload = {
      iss: "18roots-main-app",
      aud: "18roots-meeting-service",
      sub:,
      role:,
      exp: 5.minutes.from_now.to_i
    }.merge(claims)
    JWT.encode(payload, key, algorithm)
  end

  def bearer(role:, sub:)
    { "CONTENT_TYPE" => "application/json", "Authorization" => "Bearer #{platform_token(role:, sub:)}" }
  end

  def outbox_events(type = nil)
    events = OutboxMessage.where(topic: "meeting_event").order(:created_at).map(&:payload)
    type ? events.select { |event| event["type"] == type } : events
  end
end

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join("spec/fixtures")]
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include ActiveJob::TestHelper
  config.include SpecHelpers
end
