module Api
  module V1
    class BookingsController < BaseController
      rescue_from Scheduling::Bookings::Error, with: ->(error) { render_error(error.code, error.message, error.status) }
      rescue_from Payments::Gateway::Unavailable, with: -> { render_error("payment_unavailable", "Payments are unavailable right now", :service_unavailable) }

      def create
        key = request.headers["Idempotency-Key"].to_s
        replay = Payment.exists?(patient: current_user, idempotency_key: key)
        appointment = Scheduling::Bookings.create!(
          patient: current_user, doctor_id: json_body["doctorId"], slot_id: json_body["slotId"],
          reason: json_body["reason"], consent: json_body["consent"], idempotency_key: key
        )
        render json: Presenters.booking(appointment.reload), status: replay ? :ok : :created
      end

      def show
        render json: Presenters.booking(booking)
      end

      # Demo payments only. With a real provider, only its signed webhook to
      # /webhooks/payments can mark a payment as paid.
      def confirm_payment
        payment = booking.payment
        unless Payments::Gateway.demo_confirmation_allowed? && payment.provider == "demo"
          return render_error("forbidden", "Payments are confirmed by the payment provider", :forbidden)
        end
        return render_error("payment_mismatch", "Payment does not match", :unprocessable_content) unless json_body["paymentId"] == payment.id

        Scheduling::Confirmations.payment_succeeded!(payment, provider_payment_id: "demo_#{payment.id}")
        render json: Presenters.booking(booking.reload)
      end

      private

      def booking
        @booking ||= current_user.appointments.includes(:doctor, :payment, :care_notes).joins(:payment).find(params[:id])
      end
    end
  end
end
