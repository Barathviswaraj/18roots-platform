redis_options = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }

Sidekiq.configure_server do |config|
  config.redis = redis_options

  scheduler = nil
  config.on(:startup) { scheduler = RecurringJobScheduler.new.start }
  config.on(:quiet) { scheduler&.stop }
end

Sidekiq.configure_client do |config|
  config.redis = redis_options
end
