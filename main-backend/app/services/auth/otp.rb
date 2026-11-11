module Auth
  # One-time login codes sent by SMS.
  class Otp
    class Error < StandardError
      attr_reader :code, :status

      def initialize(code, message, status: 422)
        @code = code
        @status = status
        super(message)
      end
    end

    CODE_TTL = 5.minutes
    RESEND_AFTER = 30.seconds

    def self.fixed_code
      ENV["OTP_FIXED_CODE"].presence
    end

    def self.digest(phone, code)
      OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "#{phone}:#{code}")
    end

    def self.request!(phone:, ip: nil)
      raise Error.new("invalid_phone", "Enter a valid Indian mobile number") unless User::PHONE_FORMAT.match?(phone.to_s)

      last = OtpChallenge.where(phone:).order(created_at: :desc).first
      if last && last.created_at > RESEND_AFTER.ago
        wait = (last.created_at + RESEND_AFTER - Time.current).ceil
        raise Error.new("resend_too_soon", "Wait #{wait} seconds before asking for a new code", status: 429)
      end

      code = fixed_code || format("%06d", SecureRandom.random_number(1_000_000))
      challenge = OtpChallenge.create!(phone:, code_digest: digest(phone, code), expires_at: CODE_TTL.from_now, request_ip: ip)
      SmsSender.deliver(phone:, code:)
      { request_id: challenge.id, resend_after_seconds: RESEND_AFTER.to_i, demo_code: fixed_code }
    end

    ERRORS = {
      invalid_code: ["invalid_code", "That code is not right"],
      code_expired: ["code_expired", "That code has expired. Ask for a new one"],
      too_many_attempts: ["too_many_attempts", "Too many tries. Ask for a new code"]
    }.freeze

    def self.verify!(request_id:, phone:, code:, ip: nil)
      challenge_phone = nil
      # The transaction returns an outcome instead of raising, so a wrong
      # attempt is committed and counts toward the limit.
      outcome = OtpChallenge.transaction do
        challenge = OtpChallenge.lock.find_by(id: request_id.to_s)
        next :invalid_code unless challenge && challenge.phone == phone.to_s
        next :code_expired if challenge.expired? || challenge.consumed_at
        next :too_many_attempts if challenge.attempts >= OtpChallenge::MAX_ATTEMPTS

        challenge.increment!(:attempts)
        next :invalid_code unless ActiveSupport::SecurityUtils.secure_compare(challenge.code_digest, digest(challenge.phone, code.to_s))

        challenge.update!(consumed_at: Time.current)
        challenge_phone = challenge.phone
        :ok
      end
      raise Error.new(*ERRORS.fetch(outcome)) unless outcome == :ok

      user = account_for(challenge_phone)
      Sessions.start(user, ip:).merge(user:)
    end

    # Finds the account or creates it on first sign-in. Two first sign-ins at
    # once both try to insert; the loser of the race reads the winner's row.
    def self.account_for(phone)
      User.find_by(phone:) || User.create!(phone:)
    rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
      User.find_by!(phone:)
    end
  end
end
