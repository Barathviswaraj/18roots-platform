require "rails_helper"

RSpec.describe "Background jobs", type: :request do
  let(:patient) { create_patient }
  let(:doctor) { create_doctor }
  let(:calls) { [] }
  let(:answers) { { create: [201, { "meeting" => { "id" => "6c1a8e0a-1d6f-4a6c-9c11-1b2e3d4f5a6b" } }], cancel: [200, {}] } }
  let(:client) do
    Meetings::Client.new(base_url: "https://meetings.test", transport: lambda { |verb, path, payload, headers|
      calls << { verb:, path:, payload:, headers: }
      path.end_with?("/cancel") ? answers[:cancel] : answers[:create]
    })
  end

  def confirmed_appointment
    booking = book!(patient, doctor)
    post "/v1/bookings/#{booking['id']}/confirm-payment", params: { paymentId: booking.dig("payment", "id") }.to_json,
                                                           headers: auth_headers(patient)
    Appointment.find(booking["id"])
  end

  it "creates the meeting with the appointment as idempotency key and stores its ID" do
    appointment = confirmed_appointment
    OutboxDispatchJob.new.perform(meetings: client)

    expect(calls.size).to eq(1)
    expect(calls.first[:headers]).to eq("Idempotency-Key" => "appointment-#{appointment.id}")
    participants = calls.first[:payload].dig(:meeting, :participants)
    expect(participants.map { _1[:role] }).to eq(%w[doctor patient])
    expect(participants.last[:external_user_reference]).to eq(patient.id)
    expect(appointment.reload).to have_attributes(meeting_id: "6c1a8e0a-1d6f-4a6c-9c11-1b2e3d4f5a6b", consultation_status: "scheduled")
    expect(OutboxMessage.pending).to be_empty
  end

  it "retries when the meeting service is down" do
    confirmed_appointment
    answers[:create] = [503, {}]
    OutboxDispatchJob.new.perform(meetings: client)

    message = OutboxMessage.find_by(topic: "meeting_create")
    expect(message).to have_attributes(completed_at: nil, attempts: 1)
    expect(message.last_error).to include("503")
  end

  it "signs service calls with a token the meeting service accepts" do
    claims, = JWT.decode(AccessTokens.service_token, TokenKeys.public_key, true, algorithm: "RS256")
    expect(claims).to include("role" => "service", "sub" => "main-backend", "aud" => "18roots-meeting-service")
  end

  it "finishes demo refunds" do
    appointment = confirmed_appointment
    Scheduling::Cancellations.by_patient!(appointment, patient:)
    OutboxDispatchJob.new.perform(meetings: client)
    expect(appointment.payment.reload.status).to eq("refunded")
  end

  it "releases lapsed holds and marks unattended consultations" do
    hold = Appointment.find(book!(patient, doctor)["id"])
    hold.update_columns(hold_expires_at: 1.minute.ago)
    unattended = confirmed_appointment
    unattended.update_columns(starts_at: 3.hours.ago, ends_at: 150.minutes.ago)

    MaintenanceJob.perform_now
    expect(hold.reload.status).to eq("expired")
    expect(hold.payment.status).to eq("failed")
    expect(unattended.reload).to have_attributes(status: "missed", needs_review: true)
  end
end
