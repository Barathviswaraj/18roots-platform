class LivekitTokenIssuer
  TOKEN_TTL_SECONDS = 10.minutes.to_i

  def initialize(api_key: ENV.fetch("LIVEKIT_API_KEY"), api_secret: ENV.fetch("LIVEKIT_API_SECRET"))
    @api_key = api_key
    @api_secret = api_secret
  end

  def issue(participant:, meeting: participant.meeting)
    token = LiveKit::AccessToken.new(api_key: @api_key, api_secret: @api_secret, ttl: TOKEN_TTL_SECONDS)
    token.identity = participant.livekit_identity
    token.name = participant.display_name.presence || participant.role.titleize
    token.metadata = { role: participant.role, participant_id: participant.id }.to_json
    token.video_grant = LiveKit::VideoGrant.new(
      roomJoin: true,
      room: meeting.room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false
    )
    token.to_jwt
  end
end

