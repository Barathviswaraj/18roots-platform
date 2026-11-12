module Api
  module V1
    class ConsultationsController < BaseController
      def index
        now = Time.current
        scope = if current_user.role_doctor?
                  current_user.doctor.appointments.includes(:doctor, :care_notes)
                else
                  current_user.appointments.includes(:doctor, :care_notes)
                end
        items = if params[:scope] == "past"
                  scope.where(status: %w[completed missed cancelled]).or(scope.where(status: "confirmed").where(ends_at: ..now))
                       .order(starts_at: :desc).limit(50)
                else
                  scope.where(status: "confirmed").where("ends_at > ?", now)
                       .or(scope.where(status: "held").where("hold_expires_at > ?", now)).order(:starts_at)
                end
        render json: { consultations: items.map { |appointment| Presenters.consultation(appointment, now:) } }
      end

      def show
        render json: Presenters.consultation(appointment)
      end

      def cancel
        Scheduling::Cancellations.by_patient!(appointment, patient: current_user)
        render json: Presenters.consultation(appointment.reload)
      rescue Scheduling::Cancellations::NotAllowed => error
        render_error("cannot_cancel", error.message, :conflict)
      end

      private

      def appointment
        appointments = current_user.role_doctor? ? current_user.doctor.appointments : current_user.appointments
        @appointment ||= appointments.visible.includes(:doctor, :care_notes).find(params[:id])
      end
    end
  end
end
