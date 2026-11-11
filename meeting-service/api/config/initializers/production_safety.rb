if Rails.env.production?
  required = %w[
    SECRET_KEY_BASE
    PLATFORM_JWT_ISSUER
    PLATFORM_JWT_AUDIENCE
    LIVEKIT_API_KEY
    LIVEKIT_API_SECRET
    LIVEKIT_API_URL
    LIVEKIT_PUBLIC_URL
    DATABASE_URL
    REDIS_URL
  ]
  missing = required.select { |name| ENV[name].blank? }
  raise "Missing production environment variables: #{missing.join(', ')}" if missing.any?
  raise "ALLOW_DEMO_AUTH must be false in production" if ENV["ALLOW_DEMO_AUTH"] == "true"

  if ENV["PLATFORM_JWT_SECRET"].blank? && ENV["PLATFORM_JWT_PUBLIC_KEY"].blank?
    raise "Set PLATFORM_JWT_SECRET or PLATFORM_JWT_PUBLIC_KEY so login tokens can be checked"
  end
  %w[PLATFORM_JWT_SECRET PLATFORM_JWT_PREVIOUS_SECRET].each do |name|
    raise "#{name} must be at least 32 characters" if ENV[name].present? && ENV[name].length < 32
  end
  if ENV["PLATFORM_JWT_PUBLIC_KEY"].present?
    begin
      key = OpenSSL::PKey.read(ENV["PLATFORM_JWT_PUBLIC_KEY"].gsub("\\n", "\n"))
      raise "PLATFORM_JWT_PUBLIC_KEY must be an RSA or EC public key" unless key.is_a?(OpenSSL::PKey::RSA) || key.is_a?(OpenSSL::PKey::EC)
      raise "PLATFORM_JWT_PUBLIC_KEY must be the public key, not the private key" if key.private?
    rescue OpenSSL::PKey::PKeyError
      raise "PLATFORM_JWT_PUBLIC_KEY is not a readable PEM public key"
    end
  end

  creator_roles = ENV.fetch("MEETING_CREATOR_ROLES", "service").split(",").map(&:strip).compact_blank
  unless creator_roles.any? && (creator_roles - %w[service doctor patient]).empty?
    raise "MEETING_CREATOR_ROLES must list one or more of: service, doctor, patient"
  end

  if ENV["EVENTS_WEBHOOK_URL"].present?
    raise "EVENTS_WEBHOOK_URL must start with https://" unless ENV["EVENTS_WEBHOOK_URL"].start_with?("https://")
    raise "EVENTS_WEBHOOK_SECRET must be at least 32 characters" if ENV["EVENTS_WEBHOOK_SECRET"].to_s.length < 32
  end
end
