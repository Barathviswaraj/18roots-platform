class HealthController < ActionController::API
  def live
    render json: { status: "ok" }
  end

  def ready
    ActiveRecord::Base.connection_pool.with_connection { |connection| connection.select_value("SELECT 1") }
    ping_queue_store
    render json: { status: "ready" }
  rescue StandardError
    render json: { status: "not_ready" }, status: :service_unavailable
  end

  private

  # Closes its connection: this runs on every platform health check.
  def ping_queue_store
    redis = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))
    redis.ping
  ensure
    redis&.close
  end
end

