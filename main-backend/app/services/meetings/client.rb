require "net/http"

module Meetings
  # Calls the Phase 1 meeting service (meeting-service/docs/openapi.yaml) with
  # the backend's service token.
  class Client
    class Failed < StandardError; end

    def self.configured? = ENV["MEETING_SERVICE_URL"].present?

    def initialize(base_url: ENV["MEETING_SERVICE_URL"], transport: nil)
      @base = URI(base_url.to_s)
      @transport = transport || method(:request)
    end

    # The appointment ID is the idempotency key, so a retried create returns
    # the same meeting instead of making a second one.
    def create_meeting(appointment)
      status, body = @transport.call(
        :post, "/api/v1/meetings",
        {
          meeting: {
            external_appointment_reference: appointment.id,
            participants: [
              { role: "doctor", external_user_reference: appointment.doctor.meeting_reference, display_name: appointment.doctor.name },
              { role: "patient", external_user_reference: appointment.patient_id, display_name: appointment.patient.name.presence || "Patient" }
            ]
          }
        },
        { "Idempotency-Key" => "appointment-#{appointment.id}" }
      )
      raise Failed, "create meeting answered #{status}" unless status == 201

      body.fetch("meeting").fetch("id")
    end

    # 409 means the meeting already ended or was cancelled: nothing left to do.
    def cancel_meeting(meeting_id)
      status, = @transport.call(:post, "/api/v1/meetings/#{meeting_id}/cancel", nil, {})
      raise Failed, "cancel meeting answered #{status}" unless [200, 404, 409].include?(status)

      status
    end

    private

    def request(verb, path, payload, headers)
      uri = URI.join(@base, path)
      request = (verb == :post ? Net::HTTP::Post : Net::HTTP::Get).new(uri)
      request["Content-Type"] = "application/json"
      request["Authorization"] = "Bearer #{AccessTokens.service_token}"
      headers.each { |name, value| request[name] = value }
      request.body = payload.to_json if payload
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 15) do |http|
        http.request(request)
      end
      [response.code.to_i, (JSON.parse(response.body) rescue {})]
    end
  end
end
