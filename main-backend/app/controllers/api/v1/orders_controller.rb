module Api
  module V1
    class OrdersController < BaseController
      def index
        orders = current_user.orders.includes(:items, :events).order(placed_at: :desc)
        orders = case params[:status]
                 when "active" then orders.active
                 when "delivered" then orders.where(status: "delivered")
                 else orders
                 end
        render json: { orders: orders.limit(50).map { |order| Presenters.order(order) } }
      end

      def show
        render json: Presenters.order(current_user.orders.includes(:items, :events).find(params[:id]))
      end
    end
  end
end
