class PlatformAuthenticator
  class InvalidCredentials < StandardError; end

  ALLOWED_ROLES = %w[doctor patient service].freeze
  LEEWAY_SECONDS = 30

  def authenticate(authorization:, demo_role: nil, demo_subject: nil)
    if demo_auth_enabled?
      authenticate_demo!(demo_role, demo_subject)
    else
      authenticate_bearer!(authorization)
    end
  rescue JWT::DecodeError, KeyError, TypeError, ArgumentError, OpenSSL::PKey::PKeyError
    raise InvalidCredentials
  end

  private

  def demo_auth_enabled?
    ENV["ALLOW_DEMO_AUTH"] == "true" && (Rails.env.development? || Rails.env.test?)
  end

  def authenticate_demo!(role, subject)
    raise InvalidCredentials unless %w[doctor patient].include?(role)
    raise InvalidCredentials if subject.blank? || subject.length > 160

    AuthenticatedActor.new(role:, subject:)
  end

  def authenticate_bearer!(authorization)
    match = authorization.to_s.match(/\ABearer ([A-Za-z0-9._-]+)\z/)
    raise InvalidCredentials unless match

    algorithms = allowed_algorithms
    raise InvalidCredentials if algorithms.empty?

    claims, = JWT.decode(
      match[1],
      nil,
      true,
      algorithms:,
      verify_expiration: true,
      leeway: LEEWAY_SECONDS
    ) { |header| keys_for(header["alg"]) }
    now = Time.now.to_i

    raise InvalidCredentials unless claims["iss"] == ENV.fetch("PLATFORM_JWT_ISSUER")
    aud = claims["aud"]
    expected_aud = ENV.fetch("PLATFORM_JWT_AUDIENCE")
    raise InvalidCredentials unless aud == expected_aud || (aud.is_a?(Array) && aud.include?(expected_aud))
    raise InvalidCredentials unless claims["exp"].is_a?(Numeric) && claims["exp"] >= now - LEEWAY_SECONDS

    role = claims.fetch("role")
    subject = claims.fetch("sub")
    raise InvalidCredentials unless ALLOWED_ROLES.include?(role)
    raise InvalidCredentials if !subject.is_a?(String) || subject.blank? || subject.length > 160

    AuthenticatedActor.new(role:, subject:)
  end

  # HS256 with a shared secret, plus the previous secret while it is being
  # rotated out. RS256 or ES256 when the main backend's public key is set: then
  # this service can check login tokens but cannot create them.
  def allowed_algorithms
    algorithms = []
    algorithms << "HS256" if shared_secrets.any?
    algorithms << public_key_algorithm if public_key
    algorithms
  end

  def keys_for(algorithm)
    if algorithm == "HS256"
      shared_secrets
    elsif public_key && algorithm == public_key_algorithm
      [public_key]
    else
      []
    end
  end

  def shared_secrets
    @shared_secrets ||= [ENV["PLATFORM_JWT_SECRET"], ENV["PLATFORM_JWT_PREVIOUS_SECRET"]].compact_blank
  end

  def public_key
    return @public_key if defined?(@public_key)

    pem = ENV["PLATFORM_JWT_PUBLIC_KEY"]
    # Hosting dashboards often store a PEM on one line with literal "\n".
    @public_key = pem.present? ? OpenSSL::PKey.read(pem.gsub("\\n", "\n")) : nil
  end

  def public_key_algorithm
    case public_key
    when OpenSSL::PKey::RSA then "RS256"
    when OpenSSL::PKey::EC then "ES256"
    end
  end
end
