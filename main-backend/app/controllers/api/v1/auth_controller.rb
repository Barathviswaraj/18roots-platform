module Api
  module V1
    class AuthController < BaseController
      skip_before_action :authenticate!, only: %i[otp verify refresh]

      rescue_from Auth::Otp::Error, with: ->(error) { render_error(error.code, error.message, error.status) }
      rescue_from Auth::Sessions::Invalid, with: -> { render_error("invalid_refresh_token", "Please sign in again", :unauthorized) }

      def otp
        result = Auth::Otp.request!(phone: json_body["phone"].to_s, ip: request.remote_ip)
        render json: { requestId: result[:request_id], resendAfterSeconds: result[:resend_after_seconds], demoCode: result[:demo_code] }
      end

      def verify
        result = Auth::Otp.verify!(
          request_id: json_body["requestId"], phone: json_body["phone"], code: json_body["code"], ip: request.remote_ip
        )
        render json: Presenters.session(result, result.fetch(:user))
      end

      def refresh
        render json: Presenters.tokens(Auth::Sessions.refresh(json_body["refreshToken"].to_s, ip: request.remote_ip))
      end

      # Ends this phone's session family. The 15-minute access token simply expires.
      def logout
        Auth::Sessions.revoke_family(@session_id) if @session_id
        AuditEvent.record!(action: "auth.signed_out", actor: current_user, subject: current_user, ip: request.remote_ip)
        head :no_content
      end
    end
  end
end
