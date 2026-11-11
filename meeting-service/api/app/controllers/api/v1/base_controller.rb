module Api
  module V1
    class BaseController < ApplicationController
      class Forbidden < StandardError; end

      before_action :authenticate_actor!

      rescue_from PlatformAuthenticator::InvalidCredentials, with: :render_unauthorized
      rescue_from Forbidden, with: :render_forbidden
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActionController::ParameterMissing, ActionController::BadRequest, with: :render_bad_request
      rescue_from IdempotentRequest::MissingKey, with: :render_idempotency_key_required
      rescue_from IdempotentRequest::KeyConflict, with: :render_idempotency_conflict
      rescue_from ActiveRecord::RecordNotUnique, with: :render_conflict
      rescue_from ActiveRecord::RecordInvalid, with: :render_validation_error
      rescue_from Meeting::InvalidTransition, with: :render_state_conflict
      # Faraday errors: LiveKit could not be reached or timed out.
      rescue_from LiveKit::ServerError, Faraday::Error, with: :render_livekit_unavailable

      private

      attr_reader :current_actor

      def authenticate_actor!
        @current_actor = PlatformAuthenticator.new.authenticate(
          authorization: request.headers["Authorization"],
          demo_role: request.headers["X-Demo-Role"],
          demo_subject: request.headers["X-Demo-User-Reference"]
        )
      end

      def authorize_meeting!(meeting)
        return if current_actor.service?

        participant = meeting.participants.find_by(
          role: current_actor.role,
          external_user_reference: current_actor.subject
        )
        raise ActiveRecord::RecordNotFound unless participant

        participant
      end

      def meeting_json(meeting)
        MeetingPresenter.as_json(meeting)
      end

      def render_unauthorized
        render json: { error: { code: "unauthorized", message: "Valid authentication is required" } }, status: :unauthorized
      end

      def render_forbidden
        render json: { error: { code: "forbidden", message: "This account cannot do that" } }, status: :forbidden
      end

      def render_not_found
        render json: { error: { code: "not_found", message: "Meeting not found" } }, status: :not_found
      end

      def render_bad_request(error)
        render json: { error: { code: "invalid_request", message: error.message } }, status: :bad_request
      end

      def render_idempotency_key_required
        render json: { error: { code: "idempotency_key_required", message: "Provide a valid Idempotency-Key header" } }, status: :bad_request
      end

      def render_idempotency_conflict
        render json: { error: { code: "idempotency_conflict", message: "This key was already used with a different request" } }, status: :conflict
      end

      def render_conflict
        render json: { error: { code: "conflict", message: "The request conflicts with current meeting state" } }, status: :conflict
      end

      def render_state_conflict
        render json: { error: { code: "invalid_state", message: "The meeting cannot make that state change" } }, status: :conflict
      end

      def render_validation_error(error)
        render json: {
          error: {
            code: "validation_failed",
            message: "The request is not valid",
            details: error.record.errors.to_hash
          }
        }, status: :unprocessable_entity
      end

      def render_livekit_unavailable
        render json: { error: { code: "video_provider_unavailable", message: "The video service is temporarily unavailable" } }, status: :service_unavailable
      end
    end
  end
end

