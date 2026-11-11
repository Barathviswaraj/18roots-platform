require "rails_helper"

RSpec.describe "API v1 meetings", type: :request do
  let(:doctor_headers) do
    {
      "CONTENT_TYPE" => "application/json",
      "X-Demo-Role" => "doctor",
      "X-Demo-User-Reference" => "doctor-200"
    }
  end
  let(:patient_headers) do
    doctor_headers.merge("X-Demo-Role" => "patient", "X-Demo-User-Reference" => "patient-200")
  end
  let(:create_body) do
    {
      meeting: {
        external_appointment_reference: "appointment-200",
        participants: [
          { role: "doctor", external_user_reference: "doctor-200", display_name: "Doctor" },
          { role: "patient", external_user_reference: "patient-200", display_name: "Patient" }
        ]
      }
    }
  end
  let(:idempotency_key) { "test-key-2000000000000000" }

  def create_meeting!(headers = doctor_headers)
    post "/api/v1/meetings",
         params: create_body.to_json,
         headers: headers.merge("Idempotency-Key" => idempotency_key)
    expect(response).to have_http_status(:created)
    Meeting.find(JSON.parse(response.body).dig("meeting", "id"))
  end

  def prepare!(meeting, headers = doctor_headers)
    allow_any_instance_of(LivekitRoomService).to receive(:create_room)
    post "/api/v1/meetings/#{meeting.id}/prepare", headers: headers
    expect(response).to have_http_status(:ok)
  end

  it "creates an independent meeting with doctor and patient participants" do
    post "/api/v1/meetings",
         params: create_body.to_json,
         headers: doctor_headers.merge("Idempotency-Key" => idempotency_key)

    expect(response).to have_http_status(:created)
    payload = JSON.parse(response.body).fetch("meeting")
    expect(payload.fetch("external_appointment_reference")).to eq("appointment-200")
    expect(payload.fetch("meeting_type")).to eq("one_to_one")
    expect(payload.fetch("status")).to eq("scheduled")
    expect(payload.fetch("participants").map { |item| item.fetch("role") }).to contain_exactly("doctor", "patient")
    expect(outbox_events("meeting.created").size).to eq(1)
  end

  it "replays a create response for the same idempotency key" do
    2.times do
      post "/api/v1/meetings",
           params: create_body.to_json,
           headers: doctor_headers.merge("Idempotency-Key" => idempotency_key)
      expect(response).to have_http_status(:created)
    end

    expect(Meeting.count).to eq(1)
    expect(IdempotencyKey.count).to eq(1)
    expect(outbox_events("meeting.created").size).to eq(1)
  end

  it "rejects reuse of an idempotency key with a different payload" do
    create_meeting!
    changed_body = create_body.deep_dup
    changed_body[:meeting][:external_appointment_reference] = "appointment-201"

    post "/api/v1/meetings",
         params: changed_body.to_json,
         headers: doctor_headers.merge("Idempotency-Key" => idempotency_key)

    expect(response).to have_http_status(:conflict)
    expect(Meeting.count).to eq(1)
  end

  it "requires authentication for the meeting API" do
    post "/api/v1/meetings", params: create_body.to_json,
         headers: { "CONTENT_TYPE" => "application/json", "Idempotency-Key" => idempotency_key }

    expect(response).to have_http_status(:unauthorized)
  end

  it "only lets the roles in MEETING_CREATOR_ROLES create meetings" do
    with_env("MEETING_CREATOR_ROLES" => "service") do
      post "/api/v1/meetings",
           params: create_body.to_json,
           headers: doctor_headers.merge("Idempotency-Key" => idempotency_key)
    end
    expect(response).to have_http_status(:forbidden)

    post "/api/v1/meetings",
         params: create_body.to_json,
         headers: patient_headers.merge("Idempotency-Key" => idempotency_key)
    expect(response).to have_http_status(:forbidden)
    expect(Meeting.count).to eq(0)
  end

  it "does not let a doctor create a meeting for someone else" do
    other_doctor = doctor_headers.merge("X-Demo-User-Reference" => "doctor-999")

    post "/api/v1/meetings",
         params: create_body.to_json,
         headers: other_doctor.merge("Idempotency-Key" => idempotency_key)

    expect(response).to have_http_status(:forbidden)
  end

  it "shows a meeting to its participants only" do
    meeting = create_meeting!

    get "/api/v1/meetings/#{meeting.id}", headers: patient_headers
    expect(response).to have_http_status(:ok)
    participant = JSON.parse(response.body).dig("meeting", "participants").first
    expect(participant.keys).to include("joined_at", "left_at")

    get "/api/v1/meetings/#{meeting.id}", headers: patient_headers.merge("X-Demo-User-Reference" => "patient-999")
    expect(response).to have_http_status(:not_found)
  end

  it "prepares the LiveKit room and returns a room-scoped token only for a participant" do
    meeting = create_meeting!
    allow_any_instance_of(LivekitRoomService).to receive(:create_room).with(meeting.room_name)

    post "/api/v1/meetings/#{meeting.id}/prepare", headers: doctor_headers
    expect(response).to have_http_status(:ok)
    expect(meeting.reload).to be_ready

    post "/api/v1/meetings/#{meeting.id}/join-token",
         params: { role: "doctor" }.to_json,
         headers: doctor_headers

    expect(response).to have_http_status(:ok)
    token_response = JSON.parse(response.body)
    claims, = JWT.decode(token_response.fetch("token"), "secret", true, algorithm: "HS256")
    expect(claims.fetch("video")).to include("room" => meeting.room_name, "roomJoin" => true, "canPublish" => true)
    expect(claims.fetch("sub")).to eq(meeting.participants.find_by!(role: "doctor").livekit_identity)
    expect(token_response.fetch("expires_in_seconds")).to eq(600)
  end

  it "calls LiveKit without holding a database lock" do
    meeting = create_meeting!
    baseline = ActiveRecord::Base.connection.open_transactions
    seen = nil
    allow_any_instance_of(LivekitRoomService).to receive(:create_room) do
      seen = ActiveRecord::Base.connection.open_transactions
    end

    post "/api/v1/meetings/#{meeting.id}/prepare", headers: doctor_headers

    expect(response).to have_http_status(:ok)
    expect(seen).to eq(baseline)
  end

  it "does not issue a token to a role or identity outside the meeting" do
    meeting = create_meeting!
    prepare!(meeting)

    post "/api/v1/meetings/#{meeting.id}/join-token",
         params: { role: "doctor" }.to_json,
         headers: patient_headers

    expect(response).to have_http_status(:not_found)
  end

  it "ends the meeting, tells the main backend who ended it and queues room cleanup" do
    meeting = create_meeting!
    prepare!(meeting)

    post "/api/v1/meetings/#{meeting.id}/end", headers: patient_headers
    post "/api/v1/meetings/#{meeting.id}/end", headers: doctor_headers

    expect(response).to have_http_status(:accepted)
    expect(meeting.reload).to be_ended
    expect(meeting.ended_at).to be_present
    ended = outbox_events("meeting.ended")
    expect(ended.size).to eq(1)
    expect(ended.first.dig("data", "ended_by")).to eq("patient")
    expect(OutboxMessage.where(topic: "livekit_room_cleanup").pluck(:payload)).to eq([{ "room_name" => meeting.room_name }])
  end

  it "refuses to prepare an ended meeting" do
    meeting = create_meeting!
    post "/api/v1/meetings/#{meeting.id}/end", headers: doctor_headers

    post "/api/v1/meetings/#{meeting.id}/prepare", headers: doctor_headers

    expect(response).to have_http_status(:conflict)
  end

  context "with signed platform tokens" do
    around { |example| with_platform_tokens { example.run } }

    let(:service_headers) { bearer(role: "service", sub: "main-backend") }

    it "lets the main backend create and cancel meetings" do
      meeting = create_meeting!(service_headers)

      post "/api/v1/meetings/#{meeting.id}/cancel", headers: bearer(role: "doctor", sub: "doctor-200")
      expect(response).to have_http_status(:forbidden)

      2.times do
        post "/api/v1/meetings/#{meeting.id}/cancel", headers: service_headers
        expect(response).to have_http_status(:ok)
      end
      expect(meeting.reload).to be_cancelled
      expect(outbox_events("meeting.cancelled").size).to eq(1)
      expect(OutboxMessage.where(topic: "livekit_room_cleanup").count).to eq(1)

      post "/api/v1/meetings/#{meeting.id}/end", headers: service_headers
      expect(response).to have_http_status(:conflict)
    end

    it "rejects demo headers" do
      post "/api/v1/meetings",
           params: create_body.to_json,
           headers: doctor_headers.merge("Idempotency-Key" => idempotency_key)

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
