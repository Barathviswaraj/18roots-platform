require "rails_helper"

RSpec.describe "Booking, payment and cancellation", type: :request do
  let(:patient) { create_patient }
  let(:doctor) { create_doctor }

  it "lists slots in the clinic time zone and books one, returning the same booking for a retried key" do
    date = (Time.current.in_time_zone(Scheduling::Slots.zone) + 2.days).to_date
    get "/v1/doctors/#{doctor.id}/slots", params: { date: date.iso8601 }, headers: auth_headers(patient)
    save_contract("slots", response.parsed_body)
    slot = response.parsed_body["slots"].find { |item| item["available"] }
    expect(Time.iso8601(slot["startsAt"]).in_time_zone(Scheduling::Slots.zone).hour).to eq(9)

    first = book!(patient, doctor, Scheduling::Slots::Slot.new(id: slot["id"], starts_at: nil, ends_at: nil, available: true), key: "booking-key-0000000001")
    expect(response).to have_http_status(:created)
    save_contract("booking_pending", first)
    retry_body = book!(patient, doctor, Scheduling::Slots::Slot.new(id: slot["id"], starts_at: nil, ends_at: nil, available: true), key: "booking-key-0000000001")
    expect(response).to have_http_status(:ok)
    expect(retry_body["id"]).to eq(first["id"])
    expect(Appointment.count).to eq(1)
    expect(first).to include("status" => "pending_payment")
    expect(first["payment"]).to include("status" => "requires_payment", "provider" => "demo", "amount" => 600)
    expect(Appointment.last.consent_version).to eq("2026-11")
  end

  it "does not let two patients book the same time" do
    slot = future_slot(doctor)
    book!(patient, doctor, slot)
    expect(response).to have_http_status(:created)

    book!(create_patient(phone: "+919876500002"), doctor, slot)
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body.dig("error", "code")).to eq("slot_unavailable")
  end

  it "requires consent, a valid key and a real slot" do
    slot = future_slot(doctor)
    post "/v1/bookings", params: { doctorId: doctor.id, slotId: slot.id, consent: false }.to_json,
                         headers: auth_headers(patient).merge("Idempotency-Key" => "booking-key-0000000002")
    expect(response.parsed_body.dig("error", "code")).to eq("consent_required")

    post "/v1/bookings", params: { doctorId: doctor.id, slotId: slot.id, consent: true }.to_json, headers: auth_headers(patient)
    expect(response).to have_http_status(:bad_request)

    off_grid = "#{doctor.id}_#{(slot.starts_at + 7.minutes).iso8601(3)}"
    post "/v1/bookings", params: { doctorId: doctor.id, slotId: off_grid, consent: true }.to_json,
                         headers: auth_headers(patient).merge("Idempotency-Key" => "booking-key-0000000003")
    expect(response).to have_http_status(:conflict)
  end

  it "frees a slot when an unpaid hold lapses" do
    slot = future_slot(doctor)
    book!(patient, doctor, slot)
    Appointment.last.update_columns(hold_expires_at: 1.minute.ago)

    book!(create_patient(phone: "+919876500003"), doctor, slot)
    expect(response).to have_http_status(:created)
    expect(Appointment.pluck(:status)).to contain_exactly("expired", "held")
  end

  it "confirms a demo payment once, queues the meeting and tells the patient" do
    booking = book!(patient, doctor)
    2.times do
      post "/v1/bookings/#{booking['id']}/confirm-payment", params: { paymentId: booking.dig("payment", "id") }.to_json,
                                                             headers: auth_headers(patient)
    end
    save_contract("booking_confirmed", response.parsed_body)
    expect(response.parsed_body).to include("status" => "confirmed")
    expect(response.parsed_body.dig("payment", "status")).to eq("paid")
    expect(OutboxMessage.where(topic: "meeting_create").count).to eq(1)
    expect(patient.notifications.where(title: "Consultation booked").count).to eq(1)
  end

  it "only lets the payment provider confirm real payments" do
    booking = book!(patient, doctor)
    allow(Payments::Gateway).to receive(:demo_confirmation_allowed?).and_return(false)
    post "/v1/bookings/#{booking['id']}/confirm-payment", params: { paymentId: booking.dig("payment", "id") }.to_json,
                                                           headers: auth_headers(patient)
    expect(response).to have_http_status(:forbidden)
    expect(Appointment.find(booking["id"])).to have_attributes(status: "held")
  end

  it "cancels more than six hours ahead with a full refund and meeting cancellation" do
    booking = book!(patient, doctor)
    post "/v1/bookings/#{booking['id']}/confirm-payment", params: { paymentId: booking.dig("payment", "id") }.to_json,
                                                           headers: auth_headers(patient)
    Appointment.find(booking["id"]).update!(meeting_id: SecureRandom.uuid)

    post "/v1/consultations/#{booking['id']}/cancel", headers: auth_headers(patient)
    expect(response.parsed_body).to include("status" => "cancelled", "canCancel" => false)
    expect(Payment.last).to have_attributes(status: "refund_pending", refund_amount: 600)
    expect(OutboxMessage.pluck(:topic)).to include("payment_refund", "meeting_cancel")
    expect(AuditEvent.where(action: "appointment.cancelled").count).to eq(1)
  end

  it "refuses cancellation within six hours and hides other patients' bookings" do
    slot = Scheduling::Slots.for_day(doctor, Time.current.in_time_zone(Scheduling::Slots.zone).to_date + 1)
                            .find { |item| item.available && item.starts_at > 2.hours.from_now }
    booking = book!(patient, doctor, slot)
    post "/v1/bookings/#{booking['id']}/confirm-payment", params: { paymentId: booking.dig("payment", "id") }.to_json,
                                                           headers: auth_headers(patient)
    travel_to(slot.starts_at - 3.hours) do
      post "/v1/consultations/#{booking['id']}/cancel", headers: auth_headers(patient)
      expect(response).to have_http_status(:conflict)
    end

    get "/v1/consultations/#{booking['id']}", headers: auth_headers(create_patient(phone: "+919876500004"))
    expect(response).to have_http_status(:not_found)
  end
end
