# Records a lifecycle event for the main backend. Call it inside the same
# transaction as the change it describes, so the event and the change are
# saved together or not at all.
class MeetingEvents
  TYPES = %w[
    meeting.created
    meeting.started
    meeting.ended
    meeting.cancelled
    participant.joined
    participant.left
  ].freeze

  def self.publish!(meeting, type, occurred_at: Time.current, **details)
    raise ArgumentError, "unknown meeting event #{type}" unless TYPES.include?(type)

    OutboxMessage.create!(
      topic: "meeting_event",
      payload: {
        type:,
        occurred_at: occurred_at.utc.iso8601(3),
        data: { meeting: MeetingPresenter.as_json(meeting) }.merge(details)
      }
    )
  end
end
