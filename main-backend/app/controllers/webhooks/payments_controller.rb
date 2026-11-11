module Webhooks
  # Signed events from the payment service: the only proof that money moved.
  #   payment.captured  { data: { orderId, paymentId } }
  #   payment.failed    { data: { orderId } }
  #   refund.processed  { data: { orderId } }
  class PaymentsController < ActionController::API
    def create
      raw = request.raw_post
      WebhookSignature.verify!(header: request.headers["X-Payment-Signature"], body: raw, secret: ENV["PAYMENT_EVENTS_SECRET"])
      event = JSON.parse(raw)
      payment = Payment.find_by(provider_order_id: event.dig("data", "orderId"))
      return head :ok unless payment

      WebhookEvent.transaction do
        WebhookEvent.create!(source: "payment", event_id: event.fetch("id"), event_type: event.fetch("type"),
                             occurred_at: event["occurred_at"])
        case event["type"]
        when "payment.captured"
          Scheduling::Confirmations.payment_succeeded!(payment, provider_payment_id: event.dig("data", "paymentId"))
        when "payment.failed" then Scheduling::Confirmations.payment_failed!(payment)
        when "refund.processed" then Scheduling::Refunds.completed!(payment)
        end
      end
      head :ok
    rescue ActiveRecord::RecordNotUnique
      head :ok
    rescue WebhookSignature::Invalid
      head :unauthorized
    rescue JSON::ParserError, KeyError
      head :bad_request
    end
  end
end
