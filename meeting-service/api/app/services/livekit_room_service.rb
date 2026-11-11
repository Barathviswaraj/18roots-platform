class LivekitRoomService
  # LiveKit's default closes an unused room after 5 minutes, which would end the
  # meeting before someone in another place has received the meeting ID.
  EMPTY_ROOM_TIMEOUT_SECONDS = 30.minutes.to_i

  def initialize(client: nil)
    @client = client
  end

  def create_room(room_name)
    api.room.create_room(room_name, empty_timeout: EMPTY_ROOM_TIMEOUT_SECONDS)
  end

  def delete_room(room_name)
    api.room.delete_room(room: room_name)
  end

  private

  def api
    @client ||= LiveKit::LiveKitAPI.new(
      ENV.fetch("LIVEKIT_API_URL"),
      api_key: ENV.fetch("LIVEKIT_API_KEY"),
      api_secret: ENV.fetch("LIVEKIT_API_SECRET")
    )
  end
end

