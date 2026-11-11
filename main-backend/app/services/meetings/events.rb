module Meetings
  # Applies signed events from the meeting service to appointments. Events can
  # repeat or arrive out of order, so every change checks the current state.
  class Events
    def self.handle!(event)
      meeting = event.dig("data", "meeting") || {}
      appointment = Appointment.lock.find_by(meeting_id: meeting["id"]) ||
                    Appointment.lock.find_by(id: meeting["external_appointment_reference"])
      return unless appointment

      at = Time.iso8601(event["occurred_at"].to_s) rescue Time.current
      appointment.meeting_id ||= meeting["id"]

      case event["type"]
      when "meeting.created"
        appointment.consultation_status = "scheduled" if appointment.consultation_status == "not_created"
      when "meeting.started"
        if %w[not_created scheduled].include?(appointment.consultation_status)
          appointment.assign_attributes(consultation_status: "in_progress", started_at: appointment.started_at || at)
        end
      when "participant.joined"
        record_join(appointment, event.dig("data", "participant", "role"), at)
      when "meeting.ended"
        finish(appointment, meeting, event.dig("data", "ended_by"), at)
      when "meeting.cancelled"
        appointment.consultation_status = "cancelled"
      end
      appointment.save!
    end

    def self.record_join(appointment, role, at)
      appointment.doctor_joined_at ||= at if role == "doctor"
      appointment.patient_joined_at ||= at if role == "patient"
    end

    def self.finish(appointment, meeting, ended_by, at)
      Array(meeting["participants"]).each do |participant|
        record_join(appointment, participant["role"], Time.iso8601(participant["joined_at"])) if participant["joined_at"]
      end
      appointment.assign_attributes(consultation_status: "ended", ended_at: appointment.ended_at || at, ended_by:)
      return unless appointment.status == "confirmed"

      if appointment.doctor_joined_at
        appointment.status = "completed"
      else
        # The doctor never joined. Refunds for this are a business decision, so
        # support reviews it rather than the system refunding automatically.
        appointment.assign_attributes(status: "missed", needs_review: true)
        Notification.create!(
          user: appointment.patient,
          title: "Your doctor could not join",
          body: "Our team will contact you about rescheduling or a refund.",
          link: "/consultations/#{appointment.id}"
        )
      end
    end
    private_class_method :record_join, :finish
  end
end
