module Api
  module V1
    class BaseController < ApplicationController
      before_action :authenticate!

      rescue_from ActiveRecord::RecordNotFound, with: -> { render_error("not_found", "Not found", :not_found) }
      rescue_from ActiveRecord::RecordInvalid,
                  with: ->(error) { render_error("validation_failed", error.record.errors.full_messages.to_sentence, :unprocessable_content) }
      rescue_from ActionController::BadRequest, ActionController::ParameterMissing,
                  with: ->(error) { render_error("invalid_request", error.message, :bad_request) }

      private

      attr_reader :current_user

      def authenticate!
        token = request.authorization.to_s[/\ABearer ([A-Za-z0-9._-]+)\z/, 1]
        claims = AccessTokens.verify!(token.to_s)
        @session_id = claims["sid"]
        @current_user = User.find_by(id: claims["sub"])
        render_error("unauthorized", "Please sign in", :unauthorized) unless @current_user
      rescue AccessTokens::Invalid
        render_error("unauthorized", "Please sign in", :unauthorized)
      end

      def language
        request.headers["Accept-Language"].to_s.start_with?("ta") ? "ta" : "en"
      end
    end
  end
end
