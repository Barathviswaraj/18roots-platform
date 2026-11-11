module Api
  module V1
    class NotificationsController < BaseController
      def index
        items = current_user.notifications.order(created_at: :desc).limit(100)
        render json: { notifications: items.map { |item| Presenters.notification(item) } }
      end

      def read
        item = current_user.notifications.find(params[:id])
        item.update!(read_at: item.read_at || Time.current)
        render json: Presenters.notification(item)
      end

      def read_all
        current_user.notifications.unread.update_all(read_at: Time.current, updated_at: Time.current)
        head :no_content
      end
    end
  end
end
