ENV["RAILS_ENV"] ||= "test"
ENV["OTP_FIXED_CODE"] ||= "123456"
ENV["MEETING_EVENTS_SECRET"] ||= "test-meeting-events-secret-0123456789abcdef"
ENV["PAYMENT_EVENTS_SECRET"] ||= "test-payment-events-secret-0123456789abcdef"
ENV["REDIS_URL"] ||= "redis://localhost:6379/0"

require_relative "../config/environment"
abort("The RSpec suite must not run in production") if Rails.env.production?
require "rspec/rails"
Dir[Rails.root.join("spec/support/**/*.rb")].each { |file| require file }

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include ActiveJob::TestHelper
  config.include ActiveSupport::Testing::TimeHelpers
  config.include SpecHelpers
end
