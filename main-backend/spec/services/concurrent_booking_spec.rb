require "rails_helper"

# Real concurrent transactions, so no test transaction around this example.
RSpec.describe Scheduling::Bookings do
  self.use_transactional_tests = false

  after do
    [Payment, AuditEvent, Appointment, AvailabilityRule, Doctor, RefreshToken, User].each(&:delete_all)
  end

  it "gives a contested slot to exactly one of two simultaneous patients" do
    doctor = create_doctor
    slot = future_slot(doctor)
    patients = [create_patient(phone: "+919876500101"), create_patient(phone: "+919876500102")]

    results = patients.map.with_index do |patient, index|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          described_class.create!(patient:, doctor_id: doctor.id, slot_id: slot.id, reason: nil, consent: true,
                                  idempotency_key: "race-key-00000000#{index}")
          :booked
        rescue described_class::Error => error
          error.code
        end
      end
    end.map(&:value)

    expect(results).to contain_exactly(:booked, "slot_unavailable")
    expect(Appointment.where(doctor:, starts_at: slot.starts_at).count).to eq(1)
  end
end
