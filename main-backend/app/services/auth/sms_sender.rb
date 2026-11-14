module Auth
  # Sends the login code through the configured provider.
  class SmsSender
    class NotConfigured < StandardError; end

    def self.deliver(phone:, code:)
      case ENV.fetch("SMS_PROVIDER", "log")
      when "log"
        if Rails.env.development?
          Rails.logger.info("[sms] login code for #{phone}: #{code}")
        else
          Rails.logger.info("[sms] login code requested for #{phone[0, 5]}*****#{phone[-2..]}")
        end
      when "twilio"
        deliver_with_twilio(phone:, code:)
      else
        raise NotConfigured, "SMS_PROVIDER #{ENV['SMS_PROVIDER']} is not integrated yet"
      end
    end

    def self.deliver_with_twilio(phone:, code:)
      require "net/http"
      require "uri"

      account_sid = ENV["TWILIO_ACCOUNT_SID"].presence
      auth_token = ENV["TWILIO_AUTH_TOKEN"].presence
      from = ENV["TWILIO_PHONE_NUMBER"].presence
      raise NotConfigured, "Twilio credentials are missing" unless account_sid && auth_token && from

      uri = URI("https://api.twilio.com/2010-04-01/Accounts/#{account_sid}/Messages.json")
      request = Net::HTTP::Post.new(uri)
      request.basic_auth(account_sid, auth_token)
      request.set_form_data(
        "To" => phone,
        "From" => from,
        "Body" => "Your 18Roots verification code is #{code}. It expires in 5 minutes."
      )

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
        http.request(request)
      end
      return if response.is_a?(Net::HTTPSuccess)

      Rails.logger.error("[sms] Twilio request failed with HTTP #{response.code}")
      raise NotConfigured, "Twilio could not send the SMS"
    rescue Net::OpenTimeout, Net::ReadTimeout, SocketError => e
      Rails.logger.error("[sms] Twilio request failed: #{e.class}")
      raise NotConfigured, "Twilio could not be reached"
    end
  end
end
