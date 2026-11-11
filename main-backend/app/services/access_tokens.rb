# Short-lived login tokens. Their audience includes the meeting service, so the
# app can use the same token to ask it for a video join token.
class AccessTokens
  class Invalid < StandardError; end

  TTL = 15.minutes
  SERVICE_TTL = 5.minutes

  class << self
    def issuer = ENV.fetch("JWT_ISSUER", "18roots-main-app")
    def audience = ENV.fetch("JWT_AUDIENCE", "18roots-main-backend")
    def meeting_audience = ENV.fetch("MEETING_SERVICE_AUDIENCE", "18roots-meeting-service")

    def issue(user, session_id:)
      expires_at = TTL.from_now
      token = encode(
        sub: user.id,
        role: user.role,
        sid: session_id,
        aud: [audience, meeting_audience],
        exp: expires_at.to_i
      )
      [token, expires_at]
    end

    # The backend's own identity when it calls other services.
    def service_token(audience: meeting_audience)
      encode(sub: "main-backend", role: "service", aud: audience, exp: SERVICE_TTL.from_now.to_i)
    end

    def verify!(token)
      claims, = JWT.decode(
        token, TokenKeys.verification_keys, true,
        algorithm: "RS256", verify_expiration: true, leeway: 30,
        iss: issuer, verify_iss: true, aud: audience, verify_aud: true
      )
      raise Invalid unless claims["sub"].is_a?(String) && %w[patient doctor admin].include?(claims["role"])

      claims
    rescue JWT::DecodeError
      raise Invalid
    end

    private

    def encode(claims)
      payload = claims.merge(iss: issuer, iat: Time.current.to_i, jti: SecureRandom.uuid)
      JWT.encode(payload, TokenKeys.private_key, "RS256", { kid: TokenKeys.kid })
    end
  end
end
