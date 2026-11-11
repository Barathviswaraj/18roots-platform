require "rails_helper"

RSpec.describe OutboxDispatchJob do
  let(:secret) { "events-secret-0123456789abcdef0123456789" }
  let(:requests) { [] }
  let(:answer) { 204 }
  let(:delivery) do
    EventWebhookDelivery.new(
      url: "https://main-backend.example/meeting-events",
      secret:,
      transport: lambda do |uri, headers, body|
        requests << { uri:, headers:, body: }
        answer
      end
    )
  end
  let(:room_service) { instance_double(LivekitRoomService, delete_room: nil) }
  let(:meeting) do
    Meeting.create!(external_appointment_reference: "appointment-500").tap do |item|
      item.participants.create!(role: "doctor", external_user_reference: "doctor-500")
      item.participants.create!(role: "patient", external_user_reference: "patient-500")
    end
  end

  def run_job
    described_class.new.perform(event_delivery: delivery, room_service:)
  end

  it "sends each event once, signed so the main backend can verify it" do
    message = MeetingEvents.publish!(meeting, "meeting.created")

    run_job
    run_job

    expect(requests.size).to eq(1)
    sent = requests.first
    body = JSON.parse(sent[:body])
    expect(body).to include("id" => message.id, "type" => "meeting.created")
    expect(body.dig("data", "meeting", "id")).to eq(meeting.id)
    expect(sent[:headers]["X-Meeting-Event-Id"]).to eq(message.id)

    timestamp, signature = sent[:headers]["X-Meeting-Signature"].match(/\At=(\d+),v1=(\h{64})\z/).captures
    expected = OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{sent[:body]}")
    expect(signature).to eq(expected)
    expect(message.reload.completed_at).to be_present
  end

  context "when the main backend is failing" do
    let(:answer) { 500 }

    it "retries later with a growing delay and keeps the error" do
      message = MeetingEvents.publish!(meeting, "meeting.created")

      run_job

      message.reload
      expect(message.completed_at).to be_nil
      expect(message.attempts).to eq(1)
      expect(message.last_error).to include("HTTP 500")
      expect(message.next_attempt_at).to be_within(5.seconds).of(30.seconds.from_now)
    end

    it "gives up after the last attempt" do
      message = MeetingEvents.publish!(meeting, "meeting.created")
      message.update_columns(attempts: described_class::MAX_ATTEMPTS - 1)

      run_job

      expect(message.reload.failed_at).to be_present
      expect(OutboxMessage.due).to be_empty
    end
  end

  it "marks events done without sending when no webhook URL is set" do
    message = MeetingEvents.publish!(meeting, "meeting.created")

    described_class.new.perform(event_delivery: EventWebhookDelivery.new(url: nil, secret: nil), room_service:)

    expect(message.reload.completed_at).to be_present
  end

  it "deletes LiveKit rooms and treats an already-deleted room as done" do
    first = OutboxMessage.enqueue_room_cleanup!("room-a")
    second = OutboxMessage.enqueue_room_cleanup!("room-b")
    allow(room_service).to receive(:delete_room).with("room-b").and_raise(LiveKit::ServerError.new("not_found", "room not found"))

    run_job

    expect(room_service).to have_received(:delete_room).with("room-a")
    expect(first.reload.completed_at).to be_present
    expect(second.reload.completed_at).to be_present
  end

  it "retries room deletion when LiveKit cannot be reached" do
    message = OutboxMessage.enqueue_room_cleanup!("room-c")
    allow(room_service).to receive(:delete_room).and_raise(Faraday::ConnectionFailed, "connection refused")

    run_job

    expect(message.reload.completed_at).to be_nil
    expect(message.last_error).to include("connection refused")
  end

  it "queues delivery as soon as a message is committed" do
    expect { OutboxMessage.enqueue_room_cleanup!("room-d") }.to have_enqueued_job(described_class)
  end

  it "still saves the change when the queue store is down" do
    allow(described_class).to receive(:perform_later).and_raise(RedisClient::CannotConnectError, "down")

    message = OutboxMessage.enqueue_room_cleanup!("room-e")

    expect(message).to be_persisted
    expect(OutboxMessage.due).to include(message)
  end
end
