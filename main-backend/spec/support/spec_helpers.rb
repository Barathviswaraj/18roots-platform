module SpecHelpers
  def with_env(values)
    previous = values.keys.to_h { |name| [name, ENV[name]] }
    values.each { |name, value| value.nil? ? ENV.delete(name) : ENV[name] = value }
    yield
  ensure
    previous.each { |name, value| value.nil? ? ENV.delete(name) : ENV[name] = value }
  end

  def create_patient(phone: "+919876500001", name: "Test Patient")
    User.create!(phone:, name:)
  end

  def auth_headers(user)
    tokens = Auth::Sessions.start(user)
    { "Authorization" => "Bearer #{tokens[:access_token]}", "CONTENT_TYPE" => "application/json" }
  end

  def create_doctor(name: "Dr. Test Doctor", fee: 600, minutes: 30)
    doctor = Doctor.create!(
      name:, title: "Siddha Physician", registration_number: "TEST-#{SecureRandom.hex(3)}", verified_at: Time.current,
      qualifications: ["BSMS"], experience_years: 5, languages: %w[Tamil English], specialties: ["PCOD"],
      fee_amount: fee, consultation_minutes: minutes, rating: 4.5, about: "Test doctor",
      cancellation_policy: "Free cancellation up to 6 hours before the start."
    )
    (0..6).each { |weekday| doctor.availability_rules.create!(weekday:, start_minute: 9 * 60, end_minute: 18 * 60) }
    doctor
  end

  # The first free slot at least two days ahead, so cancellation is allowed.
  def future_slot(doctor, days_ahead: 2)
    date = (Time.current.in_time_zone(Scheduling::Slots.zone) + days_ahead.days).to_date
    Scheduling::Slots.for_day(doctor, date).find(&:available)
  end

  def book!(user, doctor, slot = future_slot(doctor), key: "booking-key-#{SecureRandom.hex(8)}")
    post "/v1/bookings", params: { doctorId: doctor.id, slotId: slot.id, reason: "Check-up", consent: true }.to_json,
                         headers: auth_headers(user).merge("Idempotency-Key" => key)
    response.parsed_body
  end

  def sign_meeting_event(body)
    { "CONTENT_TYPE" => "application/json",
      "X-Meeting-Signature" => WebhookSignature.sign(secret: ENV["MEETING_EVENTS_SECRET"], body:) }
  end

  def meeting_event(type, meeting_id:, appointment:, **data)
    {
      id: SecureRandom.uuid,
      type:,
      occurred_at: Time.current.utc.iso8601(3),
      data: { meeting: { id: meeting_id, external_appointment_reference: appointment.id, status: "in_progress", participants: [] } }.merge(data)
    }.to_json
  end

  # Saves a real response for the app's contract test (18roots_app/__tests__).
  def save_contract(name, body)
    File.write(Rails.root.join("spec/contract/fixtures/#{name}.json"), JSON.pretty_generate(body) + "\n")
  end
end
