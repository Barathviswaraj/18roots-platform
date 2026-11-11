module Scheduling
  class Refunds
    def self.start!(payment, amount:, reason:)
      return if %w[refund_pending refunded].include?(payment.status)

      payment.update!(status: "refund_pending", refund_amount: amount)
      OutboxMessage.create!(topic: "payment_refund", payload: { payment_id: payment.id, reason: })
      AuditEvent.record!(action: "payment.refund_started", subject: payment, metadata: { amount:, reason: })
    end

    def self.completed!(payment, now: Time.current)
      return if payment.status == "refunded"

      payment.update!(status: "refunded", refunded_at: now)
      AuditEvent.record!(action: "payment.refunded", subject: payment, metadata: { amount: payment.refund_amount })
    end
  end
end
