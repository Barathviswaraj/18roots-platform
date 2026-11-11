if Rails.env.production?
  required = %w[
    SECRET_KEY_BASE
    DATABASE_URL
    REDIS_URL
    JWT_PRIVATE_KEY
    MEETING_SERVICE_URL
    MEETING_EVENTS_SECRET
  ]
  missing = required.select { |name| ENV[name].blank? }
  raise "Missing production environment variables: #{missing.join(', ')}" if missing.any?

  begin
    key = OpenSSL::PKey.read(ENV["JWT_PRIVATE_KEY"].gsub("\\n", "\n"))
    raise "JWT_PRIVATE_KEY must be an RSA private key" unless key.is_a?(OpenSSL::PKey::RSA) && key.private?
  rescue OpenSSL::PKey::PKeyError
    raise "JWT_PRIVATE_KEY is not a readable PEM private key"
  end

  raise "MEETING_EVENTS_SECRET must be at least 32 characters" if ENV["MEETING_EVENTS_SECRET"].length < 32
  if ENV["PAYMENT_EVENTS_SECRET"].present? && ENV["PAYMENT_EVENTS_SECRET"].length < 32
    raise "PAYMENT_EVENTS_SECRET must be at least 32 characters"
  end

  # A fixed login code or app-confirmed payments would let anyone in or book
  # for free. Hosted test servers opt in explicitly; real ones must not.
  if ENV["OTP_FIXED_CODE"].present? && ENV["ALLOW_TEST_LOGIN_IN_PRODUCTION"] != "true"
    raise "OTP_FIXED_CODE is for testing; set ALLOW_TEST_LOGIN_IN_PRODUCTION=true only on a test server"
  end
  if ENV["DEMO_PAYMENTS"] == "true" && ENV["ALLOW_DEMO_PAYMENTS_IN_PRODUCTION"] != "true"
    raise "DEMO_PAYMENTS is for testing; set ALLOW_DEMO_PAYMENTS_IN_PRODUCTION=true only on a test server"
  end
end
