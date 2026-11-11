class LivekitWebhookProcessor
  def initialize(event)
    @event = event
  end

  def call
    room_name = @event.dig("room", "name") || @event.dig("participant", "roomName")
    meeting = Meeting.find_by(room_name:)
    return unless meeting

    event_name = @event["event"]
    occurred_at = event_time
    identity = @event.dig("participant", "identity")

    meeting.with_lock do
      participant = meeting.participants.find_by(livekit_identity: identity) if identity.present?

      case event_name
      when "room_started"
        start_meeting!(meeting, occurred_at)
      when "room_finished"
        finish_meeting!(meeting, occurred_at)
      when "participant_joined"
        if participant
          participant.update!(joined_at: participant.joined_at || occurred_at)
          start_meeting!(meeting, occurred_at)
          publish_participant_event!(meeting, participant, "participant.joined", occurred_at)
        end
      when "participant_left"
        if participant
          participant.update!(left_at: occurred_at)
          publish_participant_event!(meeting, participant, "participant.left", occurred_at)
        end
      end
    end
  end

  private

  def event_time
    timestamp = @event["createdAt"]
    timestamp.present? ? Time.zone.at(timestamp.to_i) : Time.current
  end

  def start_meeting!(meeting, at)
    return if meeting.terminal? || meeting.in_progress?

    meeting.transition_to!("in_progress")
    meeting.update!(started_at: at)
    MeetingEvents.publish!(meeting, "meeting.started", occurred_at: at)
  end

  def finish_meeting!(meeting, at)
    return if meeting.terminal?

    meeting.transition_to!("ended")
    meeting.update!(ended_at: at)
    # LiveKit closed the room, usually because it stayed empty.
    MeetingEvents.publish!(meeting, "meeting.ended", occurred_at: at, ended_by: "room_closed")
  end

  def publish_participant_event!(meeting, participant, type, at)
    MeetingEvents.publish!(
      meeting, type,
      occurred_at: at,
      participant: { id: participant.id, role: participant.role, external_user_reference: participant.external_user_reference }
    )
  end
end
