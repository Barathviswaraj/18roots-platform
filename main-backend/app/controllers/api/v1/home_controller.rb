module Api
  module V1
    class HomeController < BaseController
      def show
        render json: HomeView.new(current_user, language:).as_json
      end
    end
  end
end
