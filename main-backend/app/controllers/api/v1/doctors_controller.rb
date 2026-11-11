module Api
  module V1
    class DoctorsController < BaseController
      def index
        doctors = Doctor.active.includes(:availability_rules).order(:name)
        if (query = params[:query].to_s.strip).present?
          pattern = "%#{ActiveRecord::Base.sanitize_sql_like(query)}%"
          doctors = doctors.where("name ILIKE :pattern OR array_to_string(specialties, ' ') ILIKE :pattern", pattern:)
        end
        doctors = doctors.where(":language = ANY(languages)", language: params[:language]) if params[:language].present?
        render json: { doctors: doctors.map { |doctor| Presenters.doctor(doctor, next_available_at: Scheduling::Slots.next_available(doctor)) } }
      end

      def show
        doctor = Doctor.active.find(params[:id])
        render json: Presenters.doctor(doctor, next_available_at: Scheduling::Slots.next_available(doctor))
      end

      def slots
        doctor = Doctor.active.includes(:availability_rules).find(params[:id])
        date = Date.iso8601(params.require(:date))
        render json: { slots: Scheduling::Slots.for_day(doctor, date).map { |slot| Presenters.slot(slot) } }
      rescue Date::Error
        render_error("invalid_date", "Use YYYY-MM-DD", :bad_request)
      end
    end
  end
end
