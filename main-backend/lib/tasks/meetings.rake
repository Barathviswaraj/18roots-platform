namespace :meetings do
  desc "Queue video-room creation for confirmed appointments missing a meeting"
  task repair_missing_rooms: :environment do
    queued = 0

    Appointment.where(status: "confirmed", meeting_id: nil).find_each do |appointment|
      appointment.with_lock do
        next unless appointment.status == "confirmed" && appointment.meeting_id.nil?

        # A pending message will already create the room. Failed or completed
        # messages do not block a new repair attempt.
        pending = OutboxMessage.pending.where(topic: "meeting_create")
                              .where("payload ->> 'appointment_id' = ?", appointment.id.to_s)
                              .exists?
        next if pending

        OutboxMessage.create!(topic: "meeting_create", payload: { appointment_id: appointment.id })
        queued += 1
      end
    end

    puts "Queued video-room creation for #{queued} confirmed appointment(s)"
  end
end
