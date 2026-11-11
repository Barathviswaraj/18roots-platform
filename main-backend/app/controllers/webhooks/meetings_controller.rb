module Webhooks
  # Signed lifecycle events from the meeting service (see its docs/API.md).
  class MeetingsController < ActionController::API
    def create
      raw = request.raw_post
      WebhookSignature.verify!(header: request.headers["X-Meeting-Signature"], body: raw,
                               secret: ENV.fetch("MEETING_EVENTS_SECRET", Rails.env.production? ? nil : "development-meeting-events-secret"))
      event = JSON.parse(raw)
      WebhookEvent.transaction do
        WebhookEvent.create!(source: "meeting", event_id: event.fetch("id"), event_type: event.fetch("type"),
                             occurred_at: event["occurred_at"])
        Meetings::Events.handle!(event)
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
