require "net/http"

# Sends one meeting event to the main backend's webhook URL.
#
# Signature header: X-Meeting-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>
# The HMAC covers "<t>.<raw body>" with EVENTS_WEBHOOK_SECRET. Receivers should
# reject timestamps older than 5 minutes and ignore event IDs they already have.
class EventWebhookDelivery
  class DeliveryFailed < StandardError; end

  OPEN_TIMEOUT_SECONDS = 5
  READ_TIMEOUT_SECONDS = 10

  def self.signature(secret:, timestamp:, body:)
    OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{body}")
  end

  def initialize(url: ENV["EVENTS_WEBHOOK_URL"], secret: ENV["EVENTS_WEBHOOK_SECRET"], transport: nil)
    @url = url
    @secret = secret
    @transport = transport || method(:post_with_net_http)
  end

  def configured?
    @url.present?
  end

  def deliver(event_id:, body:)
    raise DeliveryFailed, "EVENTS_WEBHOOK_SECRET is not set" if @secret.blank?

    timestamp = Time.now.to_i
    headers = {
      "Content-Type" => "application/json",
      "User-Agent" => "18roots-meeting-service",
      "X-Meeting-Event-Id" => event_id,
      "X-Meeting-Signature" => "t=#{timestamp},v1=#{self.class.signature(secret: @secret, timestamp:, body:)}"
    }
    status = @transport.call(URI(@url), headers, body).to_i
    raise DeliveryFailed, "the main backend answered HTTP #{status}" unless (200..299).cover?(status)
  end

  private

  def post_with_net_http(uri, headers, body)
    request = Net::HTTP::Post.new(uri, headers)
    request.body = body
    response = Net::HTTP.start(
      uri.host, uri.port,
      use_ssl: uri.scheme == "https",
      open_timeout: OPEN_TIMEOUT_SECONDS,
      read_timeout: READ_TIMEOUT_SECONDS,
      write_timeout: READ_TIMEOUT_SECONDS
    ) { |http| http.request(request) }
    response.code
  end
end
