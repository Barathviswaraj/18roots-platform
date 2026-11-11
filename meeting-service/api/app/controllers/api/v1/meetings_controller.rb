module Api
  module V1
    class MeetingsController < BaseController
      def create
        attributes = meeting_params
        participant_attributes = attributes.fetch(:participants).map(&:to_h)
        authorize_create!(participant_attributes)

        result = IdempotentRequest.new(
          scope: "meetings:create:#{current_actor.role}:#{current_actor.subject}",
          key: request.headers["Idempotency-Key"],
          payload: attributes
        ).call do
          meeting = Meeting.create!(
            external_appointment_reference: attributes.fetch(:external_appointment_reference),
            meeting_type: "one_to_one"
          )
          participant_attributes.each do |participant|
            meeting.participants.create!(
              role: participant.fetch("role"),
              external_user_reference: participant.fetch("external_user_reference"),
              display_name: participant["display_name"]
            )
          end
          MeetingEvents.publish!(meeting, "meeting.created")
          { status: 201, body: { meeting: meeting_json(meeting) } }
        end

        render json: result.fetch(:body), status: result.fetch(:status)
      end

      def show
        meeting = find_meeting!
        render json: { meeting: meeting_json(meeting) }
      end

      def prepare
        meeting = find_meeting!
        raise Meeting::InvalidTransition, "meeting is already terminal" if meeting.terminal?

        if meeting.scheduled?
          # The LiveKit call happens outside the row lock so a slow video server
          # cannot hold database locks or connections. Creating a room that
          # already exists returns it, so repeated calls are safe.
          LivekitRoomService.new.create_room(meeting.room_name)
          meeting.with_lock { meeting.transition_to!("ready") if meeting.scheduled? }
          # Ended or cancelled meanwhile: nobody can get a token, and LiveKit
          # closes the empty room after its timeout.
          raise Meeting::InvalidTransition, "meeting is already terminal" if meeting.terminal?
        end

        render json: { meeting: meeting_json(meeting) }
      end

      def join_token
        meeting = Meeting.find(params[:id])
        requested_role = params.require(:role).to_s
        raise ActiveRecord::RecordNotFound unless requested_role == current_actor.role

        participant = authorize_meeting!(meeting)
        participant ||= meeting.participants.find_by!(role: current_actor.role, external_user_reference: current_actor.subject)
        raise Meeting::InvalidTransition, "meeting is not ready to join" unless meeting.ready? || meeting.in_progress?

        render json: {
          token: LivekitTokenIssuer.new.issue(participant:, meeting:),
          server_url: ENV.fetch("LIVEKIT_PUBLIC_URL"),
          participant: { id: participant.id, identity: participant.livekit_identity, role: participant.role },
          expires_in_seconds: LivekitTokenIssuer::TOKEN_TTL_SECONDS
        }
      end

      def end_meeting
        meeting = find_meeting!

        meeting.with_lock do
          unless meeting.ended?
            meeting.transition_to!("ended")
            meeting.update!(ended_at: Time.current)
            MeetingEvents.publish!(meeting, "meeting.ended", ended_by: current_actor.role)
            OutboxMessage.enqueue_room_cleanup!(meeting.room_name)
          end
        end

        render json: { meeting: meeting_json(meeting) }, status: :accepted
      end

      # Only the main backend cancels, for example when an appointment is
      # cancelled or refunded. A meeting in progress can also be cancelled.
      def cancel
        raise Forbidden unless current_actor.service?

        meeting = Meeting.find(params[:id])
        meeting.with_lock do
          unless meeting.cancelled?
            meeting.transition_to!("cancelled")
            meeting.update!(ended_at: Time.current)
            MeetingEvents.publish!(meeting, "meeting.cancelled")
            OutboxMessage.enqueue_room_cleanup!(meeting.room_name)
          end
        end

        render json: { meeting: meeting_json(meeting) }
      end

      private

      def find_meeting!
        meeting = Meeting.find(params[:id])
        authorize_meeting!(meeting)
        meeting
      end

      def meeting_params
        attributes = params.require(:meeting).permit(
          :external_appointment_reference,
          participants: [:role, :external_user_reference, :display_name]
        )
        participants = attributes[:participants]
        unless attributes[:external_appointment_reference].present? && participants.is_a?(Array) && participants.size == 2
          raise ActionController::BadRequest, "Provide an appointment reference and exactly two participants"
        end
        roles = participants.map { |participant| participant[:role] }.sort
        raise ActionController::BadRequest, "Participants must be one doctor and one patient" unless roles == %w[doctor patient]

        attributes
      end

      # In production only the main backend (role "service") creates meetings,
      # after it has confirmed the appointment. MEETING_CREATOR_ROLES can also
      # allow doctors or patients, for test apps without a main backend.
      def authorize_create!(participants)
        raise Forbidden unless self.class.creator_roles.include?(current_actor.role)
        return if current_actor.service?

        match = participants.any? do |participant|
          participant["role"] == current_actor.role && participant["external_user_reference"] == current_actor.subject
        end
        raise Forbidden unless match
      end

      def self.creator_roles
        ENV.fetch("MEETING_CREATOR_ROLES", "service").split(",").map(&:strip).compact_blank
      end
    end
  end
end
