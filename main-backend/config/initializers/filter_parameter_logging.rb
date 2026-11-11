# Login codes, tokens and signatures never reach the logs.
Rails.application.config.filter_parameters += %i[
  authorization
  code
  token
  access_token
  refresh_token
  signature
  secret
  private_key
]
