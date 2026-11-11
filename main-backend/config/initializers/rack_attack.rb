Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
  url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"),
  namespace: "main-backend:rate-limit"
)

module RateLimitIdentity
  ENV_KEY = "main_backend.rate_limit_user".freeze

  def self.json(request)
    request.env["main_backend.json_body"] ||= begin
      body = request.body.read
      request.body.rewind
      JSON.parse(body.presence || "{}")
    rescue JSON::ParserError
      {}
    end
  end

  # The verified user ID, or nil. Forged tokens fall back to per-IP limits.
  def self.user_id(request)
    return request.env[ENV_KEY] if request.env.key?(ENV_KEY)

    token = request.get_header("HTTP_AUTHORIZATION").to_s[/\ABearer (.+)\z/, 1]
    request.env[ENV_KEY] = token && AccessTokens.verify!(token)["sub"]
  rescue AccessTokens::Invalid
    request.env[ENV_KEY] = nil
  end
end

# Login codes cost money to send and can be used to harass a number.
Rack::Attack.throttle("otp/phone", limit: 5, period: 1.hour) do |request|
  RateLimitIdentity.json(request)["phone"].to_s.presence if request.post? && request.path == "/v1/auth/otp"
end
Rack::Attack.throttle("otp/ip", limit: 20, period: 1.hour) do |request|
  request.ip if request.post? && request.path == "/v1/auth/otp"
end
Rack::Attack.throttle("verify/ip", limit: 30, period: 10.minutes) do |request|
  request.ip if request.post? && %w[/v1/auth/verify /v1/auth/refresh].include?(request.path)
end

# Signed-in people: per person, so phones sharing a mobile network IP do not
# share a limit. Everyone else: per IP.
Rack::Attack.throttle("api/user", limit: 300, period: 5.minutes) do |request|
  RateLimitIdentity.user_id(request) if request.path.start_with?("/v1/") && !request.path.start_with?("/v1/auth/")
end
Rack::Attack.throttle("api/anonymous-ip", limit: 300, period: 5.minutes) do |request|
  request.ip if request.path.start_with?("/v1/") && RateLimitIdentity.user_id(request).nil?
end
Rack::Attack.throttle("webhooks/ip", limit: 6000, period: 5.minutes) do |request|
  request.ip if request.post? && request.path.start_with?("/webhooks/")
end

Rack::Attack.throttled_responder = lambda do |request|
  retry_after = request.env["rack.attack.match_data"][:period]
  [429, { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
   [{ error: { code: "rate_limited", message: "Too many requests" } }.to_json]]
end
