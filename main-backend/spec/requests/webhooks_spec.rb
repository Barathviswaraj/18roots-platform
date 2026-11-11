require "rails_helper"

RSpec.describe "Events from other services", type: :request do
  let(:patient) { create_patient }
  let(:doctor) { create_doctor }
  let(:meeting_id) { SecureRandom.uuid }
  let(:appointment) do
    booking = book!(patient, doctor)
    post "/v1/bookings/#{booking['id']}/confirm-payment", params: { paymentId: booking.dig("payment", "id") }.to_json,
                                                           headers: auth_headers(patient)
    Appointment.find(booking["id"]).tap { |item| item.update!(meeting_id:, consultation_status: "scheduled") }
  end

  def send_meeting(body, headers = sign_meeting_event(body))
    post "/webhooks/meetings", params: body, headers:
  end

  it "rejects unsigned, tampered and stale events" do
    body = meeting_event("meeting.started", meeting_id:, appointment:)
    send_meeting(body, { "CONTENT_TYPE" => "application/json" })
    expect(response).to have_http_status(:unauthorized)
    send_meeting(body.sub("meeting.started", "meeting.ended"), sign_meeting_event(body))
    expect(response).to have_http_status(:unauthorized)
    stale = { "CONTENT_TYPE" => "application/json",
              "X-Meeting-Signature" => WebhookSignature.sign(secret: ENV["MEETING_EVENTS_SECRET"], body:, timestamp: 10.minutes.ago.to_i) }
    send_meeting(body, stale)
    expect(response).to have_http_status(:unauthorized)
    expect(appointment.reload.consultation_status).to eq("scheduled")
  end

  it "follows a call from start to a completed consultation, once per event" do
    started = meeting_event("meeting.started", meeting_id:, appointment:)
    2.times { send_meeting(started) }
    expect(WebhookEvent.count).to eq(1)
    expect(appointment.reload.consultation_status).to eq("in_progress")
    get "/v1/consultations/#{appointment.id}", headers: auth_headers(patient)
    expect(response.parsed_body["status"]).to eq("in_progress")

    send_meeting(meeting_event("participant.joined", meeting_id:, appointment:, participant: { role: "doctor" }))
    send_meeting(meeting_event("meeting.ended", meeting_id:, appointment:, ended_by: "patient"))
    expect(appointment.reload).to have_attributes(status: "completed", consultation_status: "ended", ended_by: "patient")
    expect(appointment.doctor_joined_at).to be_present
  end

  it "flags a consultation the doctor never joined for support" do
    send_meeting(meeting_event("meeting.ended", meeting_id:, appointment:, ended_by: "room_closed"))
    expect(appointment.reload).to have_attributes(status: "missed", needs_review: true)
    expect(patient.notifications.where(title: "Your doctor could not join").count).to eq(1)
  end

  context "with the payment service" do
    let(:booking) { book!(patient, doctor) }

    def send_payment(type, data)
      body = { id: SecureRandom.uuid, type:, occurred_at: Time.current.iso8601, data: }.to_json
      post "/webhooks/payments", params: body, headers: {
        "CONTENT_TYPE" => "application/json",
        "X-Payment-Signature" => WebhookSignature.sign(secret: ENV["PAYMENT_EVENTS_SECRET"], body:)
      }
    end

    it "confirms on a signed capture and expires the hold on failure" do
      order_id = Payment.find_by(appointment_id: booking["id"]).provider_order_id
      send_payment("payment.captured", { orderId: order_id, paymentId: "pay_123" })
      expect(response).to have_http_status(:ok)
      expect(Appointment.find(booking["id"]).status).to eq("confirmed")
      expect(Payment.last.provider_payment_id).to eq("pay_123")

      other = book!(create_patient(phone: "+919876500005"), doctor, future_slot(doctor, days_ahead: 3))
      send_payment("payment.failed", { orderId: Payment.find_by(appointment_id: other["id"]).provider_order_id })
      expect(Appointment.find(other["id"]).status).to eq("expired")
    end
  end
end
