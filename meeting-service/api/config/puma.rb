threads_count = ENV.fetch("RAILS_MAX_THREADS", 5).to_i
threads threads_count, threads_count

production_environment = ENV.fetch("RAILS_ENV", "development") == "production"
workers ENV.fetch("WEB_CONCURRENCY", production_environment ? 2 : 0).to_i
port ENV.fetch("PORT", 3000)
environment ENV.fetch("RAILS_ENV", "development")
plugin :tmp_restart

