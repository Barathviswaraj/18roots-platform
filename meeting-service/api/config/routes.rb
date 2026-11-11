Rails.application.routes.draw do
  get "/health/live", to: "health#live"
  get "/health/ready", to: "health#ready"

  namespace :api do
    namespace :v1 do
      resources :meetings, only: [:create, :show] do
        member do
          post :prepare
          post "join-token", action: :join_token
          post :end, action: :end_meeting
          post :cancel
        end
      end
      post "livekit/webhook", to: "livekit_webhooks#create"
    end
  end
end
