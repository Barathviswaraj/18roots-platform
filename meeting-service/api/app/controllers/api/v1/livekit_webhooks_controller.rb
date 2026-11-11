module Api
  module V1
    class LivekitWebhooksController < ActionController::API
      def create
        raw_body = request.raw_post
        LivekitWebhookVerifier.new.verify!(authorization: request.headers["Authorization"], raw_body:)
        event = JSON.parse(raw_body)
        raise ActionController::BadRequest, "Webhook event id and event name are required" if event["id"].blank? || event["event"].blank?

        room_name = event.dig("room", "name") || event.dig("participant", "roomName")
        identity = event.dig("participant", "identity")
        WebhookEvent.transaction do
          WebhookEvent.create!(
            event_id: event.fetch("id"),
            event_name: event.fetch("event"),
            room_name:,
            participant_identity: identity,
            occurred_at: event["createdAt"].present? ? Time.zone.at(event["createdAt"].to_i) : Time.current,
            # Keep only fields needed for audit and diagnosis; do not retain full participant metadata.
            payload: event.slice("id", "event", "createdAt")
          )
          LivekitWebhookProcessor.new(event).call
          WebhookEvent.where(event_id: event.fetch("id")).update_all(processed_at: Time.current)
        end

        head :accepted
      rescue ActiveRecord::RecordNotUnique
        head :ok
      rescue LivekitWebhookVerifier::InvalidSignature
        head :unauthorized
      rescue JSON::ParserError, ActionController::BadRequest
        head :bad_request
      end
    end
  end
end
