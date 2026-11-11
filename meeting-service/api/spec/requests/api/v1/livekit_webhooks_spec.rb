require "rails_helper"

RSpec.describe "LiveKit webhooks", type: :request do
  def signed_headers(raw_body)
    signature = JWT.encode(
      { iss: "devkey", sha256: Digest::SHA256.base64digest(raw_body), exp: 1.minute.from_now.to_i },
      "secret",
      "HS256"
    )
    { "CONTENT_TYPE" => "application/webhook+json", "Authorization" => signature }
  end

  def send_event(event)
    raw_body = event.to_json
    post "/api/v1/livekit/webhook", params: raw_body, headers: signed_headers(raw_body)
  end

  let(:meeting) do
    Meeting.create!(external_appointment_reference: "appointment-300", status: "scheduled").tap do |item|
      item.participants.create!(role: "doctor", external_user_reference: "doctor-300")
      item.participants.create!(role: "patient", external_user_reference: "patient-300")
      item.transition_to!("ready")
    end
  end
  let(:doctor) { meeting.participants.find_by!(role: "doctor") }

  it "validates, stores and deduplicates signed events" do
    event = { id: "event-300", event: "room_started", createdAt: Time.current.to_i, room: { name: "unknown-room" } }

    2.times { send_event(event) }

    expect(response).to have_http_status(:ok)
    expect(WebhookEvent.count).to eq(1)
    expect(WebhookEvent.first.payload.keys).to contain_exactly("id", "event", "createdAt")
  end

  it "rejects a webhook whose body does not match the signed digest" do
    raw_body = { id: "event-301", event: "room_started", room: { name: "unknown-room" } }.to_json
    headers = signed_headers(raw_body).merge("Authorization" => "invalid-signature")

    post "/api/v1/livekit/webhook", params: raw_body, headers: headers

    expect(response).to have_http_status(:unauthorized)
    expect(WebhookEvent.count).to eq(0)
  end

  it "starts the meeting when a participant joins and tells the main backend once" do
    joined_at = 1.minute.ago.to_i
    event = {
      id: "event-302", event: "participant_joined", createdAt: joined_at,
      room: { name: meeting.room_name }, participant: { identity: doctor.livekit_identity }
    }

    2.times { send_event(event) }

    expect(meeting.reload).to be_in_progress
    expect(doctor.reload.joined_at.to_i).to eq(joined_at)
    expect(outbox_events.map { |item| item["type"] }).to eq(%w[meeting.started participant.joined])
    joined = outbox_events("participant.joined").first
    expect(joined.dig("data", "participant", "role")).to eq("doctor")
    expect(joined.dig("data", "meeting", "participants").find { |item| item["role"] == "doctor" }["joined_at"]).to be_present
  end

  it "ends the meeting when LiveKit closes the room" do
    send_event(id: "event-303", event: "room_finished", createdAt: Time.current.to_i, room: { name: meeting.room_name })
    send_event(id: "event-304", event: "room_finished", createdAt: Time.current.to_i, room: { name: meeting.room_name })

    expect(meeting.reload).to be_ended
    ended = outbox_events("meeting.ended")
    expect(ended.size).to eq(1)
    expect(ended.first.dig("data", "ended_by")).to eq("room_closed")
  end
end
