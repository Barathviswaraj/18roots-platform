Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
  url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"),
  namespace: "meeting-service:rate-limit"
)

# Rate limits key on the signed-in user where possible. Many phones on one
# mobile network share a public IP address, so a per-IP limit alone would
# block real users when the app grows.
module RateLimitIdentity
  WEBHOOK_PATH = "/api/v1/livekit/webhook".freeze
  ENV_KEY = "meeting_service.rate_limit_actor".freeze

  def self.api_request?(request)
    request.path.start_with?("/api/v1/") && request.path != WEBHOOK_PATH
  end

  # The verified caller, or nil for missing or invalid credentials. Forged
  # tokens fail verification and fall back to the per-IP limit.
  def self.actor(request)
    return request.env[ENV_KEY] if request.env.key?(ENV_KEY)

    request.env[ENV_KEY] =
      begin
        PlatformAuthenticator.new.authenticate(
          authorization: request.get_header("HTTP_AUTHORIZATION"),
          demo_role: request.get_header("HTTP_X_DEMO_ROLE"),
          demo_subject: request.get_header("HTTP_X_DEMO_USER_REFERENCE")
        )
      rescue PlatformAuthenticator::InvalidCredentials
        nil
      end
  end
end

# Doctors and patients: per person.
Rack::Attack.throttle("api/user", limit: 300, period: 5.minutes) do |request|
  next unless RateLimitIdentity.api_request?(request)

  actor = RateLimitIdentity.actor(request)
  "#{actor.role}:#{actor.subject}" if actor && !actor.service?
end

# The main backend calls on behalf of every user, so it gets a larger limit.
Rack::Attack.throttle("api/service", limit: ENV.fetch("SERVICE_RATE_LIMIT", 6000).to_i, period: 5.minutes) do |request|
  next unless RateLimitIdentity.api_request?(request)

  actor = RateLimitIdentity.actor(request)
  actor.subject if actor&.service?
end

# Missing or invalid credentials: per IP address.
Rack::Attack.throttle("api/anonymous-ip", limit: 300, period: 5.minutes) do |request|
  request.ip if RateLimitIdentity.api_request?(request) && RateLimitIdentity.actor(request).nil?
end

# LiveKit webhooks come from a few LiveKit addresses for every meeting, and
# each one is signature-checked, so they get their own, larger limit.
Rack::Attack.throttle("livekit-webhook/ip", limit: 6000, period: 5.minutes) do |request|
  request.ip if request.post? && request.path == RateLimitIdentity::WEBHOOK_PATH
end

Rack::Attack.throttled_responder = lambda do |request|
  retry_after = request.env["rack.attack.match_data"][:period]
  [429, { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s }, [{ error: { code: "rate_limited", message: "Too many requests" } }.to_json]]
end
