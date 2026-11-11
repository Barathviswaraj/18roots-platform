module Auth
  # Sends the login code. "log" writes it to the development log only; a real
  # SMS provider (for example MSG91 or Twilio) plugs in here before launch.
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
      else
        raise NotConfigured, "SMS_PROVIDER #{ENV['SMS_PROVIDER']} is not integrated yet"
      end
    end
  end
end
