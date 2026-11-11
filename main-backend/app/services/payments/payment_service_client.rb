require "net/http"

module Payments
  # The contract the Phase 2b payment service is expected to offer:
  #   POST /v1/orders  { reference, amount, currency, customer } -> { id, checkoutUrl }
  #   POST /v1/orders/:id/refunds { amount, reason }             -> { status }
  # Calls carry a service token. Payment results arrive as signed webhooks at
  # POST /webhooks/payments, never from the app.
  class PaymentServiceClient
    def initialize(base_url: ENV["PAYMENT_SERVICE_URL"], http: nil)
      raise Gateway::Unavailable, "PAYMENT_SERVICE_URL is not set" if base_url.blank?

      @base = URI(base_url)
      @http = http || method(:post_json)
    end

    def create_order(payment)
      body = @http.call(
        "/v1/orders",
        { reference: payment.id, amount: payment.amount, currency: payment.currency, customer: payment.patient_id },
        "Idempotency-Key" => "payment-#{payment.id}"
      )
      Gateway::Order.new(provider: "payment_service", provider_order_id: body.fetch("id"), checkout_url: body.fetch("checkoutUrl"))
    end

    def refund(payment)
      @http.call("/v1/orders/#{payment.provider_order_id}/refunds", { amount: payment.refund_amount, reason: "cancelled" },
                 "Idempotency-Key" => "refund-#{payment.id}")
      :pending
    end

    private

    def post_json(path, payload, headers)
      uri = URI.join(@base, path)
      request = Net::HTTP::Post.new(uri, headers.merge(
        "Content-Type" => "application/json",
        "Authorization" => "Bearer #{AccessTokens.service_token(audience: ENV.fetch('PAYMENT_SERVICE_AUDIENCE', '18roots-payment-service'))}"
      ))
      request.body = payload.to_json
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 15) do |http|
        http.request(request)
      end
      raise Gateway::Unavailable, "payment service answered #{response.code}" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    end
  end
end
