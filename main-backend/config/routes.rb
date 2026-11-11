Rails.application.routes.draw do
  get "/health/live", to: "health#live"
  get "/health/ready", to: "health#ready"
  get "/.well-known/jwks.json", to: "well_known#jwks"

  scope "/v1", module: "api/v1", defaults: { format: :json } do
    post "auth/otp", to: "auth#otp"
    post "auth/verify", to: "auth#verify"
    post "auth/refresh", to: "auth#refresh"
    post "auth/logout", to: "auth#logout"

    get "me", to: "profiles#show"
    patch "me", to: "profiles#update"
    get "home", to: "home#show"

    get "care-plan", to: "care_plans#show"
    post "care-plan/doses/:id", to: "care_plans#dose"
    put "care-plan/goals/:id", to: "care_plans#goal"

    get "doctors", to: "doctors#index"
    get "doctors/:id", to: "doctors#show"
    get "doctors/:id/slots", to: "doctors#slots"

    get "consultations", to: "consultations#index"
    get "consultations/:id", to: "consultations#show"
    post "consultations/:id/cancel", to: "consultations#cancel"

    post "bookings", to: "bookings#create"
    get "bookings/:id", to: "bookings#show"
    post "bookings/:id/confirm-payment", to: "bookings#confirm_payment"

    get "orders", to: "orders#index"
    get "orders/:id", to: "orders#show"

    get "notifications", to: "notifications#index"
    post "notifications/read-all", to: "notifications#read_all"
    post "notifications/:id/read", to: "notifications#read"
  end

  post "/webhooks/meetings", to: "webhooks/meetings#create"
  post "/webhooks/payments", to: "webhooks/payments#create"
end
