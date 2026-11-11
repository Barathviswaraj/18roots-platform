module Payments
  # Creates payment orders. "demo" moves no money and is confirmed through
  # POST /v1/bookings/:id/confirm-payment, which only works when DEMO_PAYMENTS
  # is on. "payment_service" asks the payment microservice (Phase 2b) for a
  # checkout link; its signed webhook is the only proof of payment.
  class Gateway
    Order = Data.define(:provider, :provider_order_id, :checkout_url)

    class Unavailable < StandardError; end

    def self.provider = ENV.fetch("PAYMENT_PROVIDER", "demo")

    def self.demo_confirmation_allowed?
      provider == "demo" && (ENV["DEMO_PAYMENTS"] == "true" || !Rails.env.production?)
    end

    def self.create_order(payment)
      case provider
      when "demo"
        Order.new(provider: "demo", provider_order_id: "demo_#{payment.id}", checkout_url: nil)
      when "payment_service"
        PaymentServiceClient.new.create_order(payment)
      else
        raise Unavailable, "Unknown PAYMENT_PROVIDER #{provider}"
      end
    end

    def self.refund(payment)
      case payment.provider
      when "demo" then :refunded
      when "payment_service" then PaymentServiceClient.new.refund(payment)
      end
    end
  end
end
