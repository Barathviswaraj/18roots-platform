Rails.application.config.filter_parameters += %i[
  authorization
  token
  access_token
  refresh_token
  api_secret
  platform_jwt_secret
  participant
]

