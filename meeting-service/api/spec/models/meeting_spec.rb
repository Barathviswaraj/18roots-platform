require "rails_helper"

RSpec.describe Meeting, type: :model do
  it "starts in scheduled state and only allows valid transitions" do
    meeting = described_class.create!(external_appointment_reference: "appointment-100")

    expect(meeting).to be_scheduled
    meeting.transition_to!("ready")
    meeting.transition_to!("in_progress")
    meeting.transition_to!("ended")

    expect(meeting).to be_ended
    expect { meeting.transition_to!("ready") }.to raise_error(Meeting::InvalidTransition)
  end

  it "requires one doctor and one patient participant" do
    meeting = described_class.create!(external_appointment_reference: "appointment-101")
    meeting.participants.create!(role: "doctor", external_user_reference: "doctor-101")

    expect do
      meeting.participants.create!(role: "doctor", external_user_reference: "doctor-102")
    end.to raise_error(ActiveRecord::RecordInvalid)
  end
end

