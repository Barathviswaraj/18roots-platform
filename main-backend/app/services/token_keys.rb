# The RS256 key pair that signs login tokens. Other services, such as the
# meeting service, check tokens with the public key from /.well-known/jwks.json
# and cannot create tokens themselves.
class TokenKeys
  DEV_KEY_PATH = Rails.root.join("tmp/development_jwt_key.pem")

  class << self
    def private_key
      @private_key ||= load_private_key
    end

    def public_key
      private_key.public_key
    end

    # Accepted while rotating keys: tokens signed by the previous key stay valid.
    def verification_keys
      [public_key, previous_public_key].compact
    end

    def kid
      @kid ||= Base64.urlsafe_encode64(Digest::SHA256.digest(public_key.to_der), padding: false)[0, 16]
    end

    def jwks
      keys = [JWT::JWK.new(public_key, kid:).export.merge(use: "sig", alg: "RS256")]
      if previous_public_key
        previous_kid = Base64.urlsafe_encode64(Digest::SHA256.digest(previous_public_key.to_der), padding: false)[0, 16]
        keys << JWT::JWK.new(previous_public_key, kid: previous_kid).export.merge(use: "sig", alg: "RS256")
      end
      { keys: }
    end

    def reset!
      @private_key = @kid = @previous_public_key = nil
    end

    private

    def previous_public_key
      return @previous_public_key if defined?(@previous_public_key) && @previous_public_key

      pem = ENV["JWT_PREVIOUS_PUBLIC_KEY"]
      @previous_public_key = pem.present? ? OpenSSL::PKey.read(pem.gsub("\\n", "\n")) : nil
    end

    def load_private_key
      pem = ENV["JWT_PRIVATE_KEY"]
      return OpenSSL::PKey.read(pem.gsub("\\n", "\n")) if pem.present?
      raise "JWT_PRIVATE_KEY is required" if Rails.env.production?
      return OpenSSL::PKey::RSA.generate(2048) if Rails.env.test?

      # Development: one key per checkout, kept out of Git in tmp/.
      FileUtils.mkdir_p(DEV_KEY_PATH.dirname)
      File.write(DEV_KEY_PATH, OpenSSL::PKey::RSA.generate(2048).to_pem, perm: 0o600) unless File.exist?(DEV_KEY_PATH)
      OpenSSL::PKey.read(File.read(DEV_KEY_PATH))
    end
  end
end
