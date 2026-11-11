# The meeting shape used in API responses and in events, so the main backend
# sees the same fields in both.
class MeetingPresenter
  def self.as_json(meeting)
    {
      id: meeting.id,
      external_appointment_reference: meeting.external_appointment_reference,
      meeting_type: meeting.meeting_type,
      status: meeting.status,
      started_at: meeting.started_at,
      ended_at: meeting.ended_at,
      participants: meeting.participants.sort_by(&:role).map do |participant|
        {
          id: participant.id,
          role: participant.role,
          external_user_reference: participant.external_user_reference,
          display_name: participant.display_name,
          joined_at: participant.joined_at,
          left_at: participant.left_at
        }
      end
    }
  end
end
