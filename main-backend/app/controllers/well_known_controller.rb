# Public keys other services use to check this backend's login tokens.
class WellKnownController < ActionController::API
  def jwks
    expires_in 10.minutes, public: true
    render json: TokenKeys.jwks
  end
end
