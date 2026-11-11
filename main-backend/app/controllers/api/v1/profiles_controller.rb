module Api
  module V1
    class ProfilesController < BaseController
      def show
        render json: Presenters.user(current_user)
      end

      def update
        attributes = {}
        attributes[:name] = json_body["name"].to_s.strip if json_body.key?("name")
        attributes[:email] = json_body["email"].to_s.strip.presence if json_body.key?("email")
        attributes[:city] = json_body["city"].to_s.strip.presence if json_body.key?("city")
        attributes[:date_of_birth] = parse_date(json_body["dateOfBirth"]) if json_body.key?("dateOfBirth")
        current_user.update!(attributes)
        AuditEvent.record!(action: "profile.updated", actor: current_user, subject: current_user, ip: request.remote_ip,
                           metadata: { fields: attributes.keys })
        render json: Presenters.user(current_user)
      end

      private

      def parse_date(value)
        return nil if value.blank?

        date = Date.strptime(value.to_s, "%d/%m/%Y")
        raise ActionController::BadRequest, "dateOfBirth must be in the past" unless date < Date.current

        date
      rescue Date::Error
        raise ActionController::BadRequest, "dateOfBirth must be DD/MM/YYYY"
      end
    end
  end
end
