# Checks "t=<unix seconds>,v1=<hex HMAC-SHA256 of '<t>.<raw body>'>", the format
# the meeting service sends (and the payment service is asked to use).
class WebhookSignature
  class Invalid < StandardError; end

  TOLERANCE = 5.minutes

  def self.verify!(header:, body:, secret:, now: Time.current)
    raise Invalid, "no secret configured" if secret.blank?

    timestamp, signature = header.to_s.match(/\At=(\d+),v1=(\h{64})\z/)&.captures
    raise Invalid, "malformed signature" unless timestamp
    raise Invalid, "stale signature" if (now.to_i - timestamp.to_i).abs > TOLERANCE.to_i

    expected = OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{body}")
    raise Invalid, "signature mismatch" unless ActiveSupport::SecurityUtils.secure_compare(expected, signature)

    true
  end

  def self.sign(secret:, body:, timestamp: Time.current.to_i)
    "t=#{timestamp},v1=#{OpenSSL::HMAC.hexdigest('SHA256', secret, "#{timestamp}.#{body}")}"
  end
end
