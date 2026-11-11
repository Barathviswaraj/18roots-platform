class LivekitWebhookVerifier
  class InvalidSignature < StandardError; end

  def verify!(authorization:, raw_body:)
    raise InvalidSignature if authorization.blank? || raw_body.blank?

    claims, = JWT.decode(
      authorization,
      ENV.fetch("LIVEKIT_API_SECRET"),
      true,
      algorithm: "HS256",
      verify_expiration: true,
      leeway: 30
    )

    # LiveKit signs the base64 form of the SHA-256 digest, not the hex form.
    expected_hash = Digest::SHA256.base64digest(raw_body)
    raise InvalidSignature unless claims["iss"] == ENV.fetch("LIVEKIT_API_KEY")
    raise InvalidSignature unless claims["sha256"].is_a?(String)
    raise InvalidSignature unless claims["sha256"].bytesize == expected_hash.bytesize
    raise InvalidSignature unless ActiveSupport::SecurityUtils.secure_compare(claims["sha256"], expected_hash)

    true
  rescue JWT::DecodeError, KeyError, TypeError, ArgumentError
    raise InvalidSignature
  end
end

