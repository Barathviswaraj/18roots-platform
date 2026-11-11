module Auth
  # Refresh tokens: random, stored as a hash, used once. Each use returns a new
  # pair in the same family. Presenting a token that was already used means it
  # was copied, so the whole family is revoked and the person signs in again.
  class Sessions
    class Invalid < StandardError; end

    REFRESH_TTL = 30.days

    def self.digest(raw) = Digest::SHA256.hexdigest(raw.to_s)

    def self.start(user, ip: nil)
      family_id = SecureRandom.uuid
      user.update!(last_sign_in_at: Time.current)
      AuditEvent.record!(action: "auth.signed_in", actor: user, subject: user, ip:)
      issue(user, family_id)
    end

    def self.refresh(raw, ip: nil)
      record = nil
      # The transaction returns an outcome instead of raising, so revoking a
      # family on reuse is committed rather than rolled back with the error.
      outcome = RefreshToken.transaction do
        record = RefreshToken.lock.find_by(token_digest: digest(raw))
        next :unknown unless record

        if record.used_at || record.revoked_at
          revoke_family(record.family_id)
          next record.used_at ? :reused : :revoked
        end
        next :expired if record.expires_at <= Time.current

        record.update!(used_at: Time.current)
        :ok
      end
      AuditEvent.record!(action: "auth.refresh_reused", actor: record.user, subject: record.user, ip:) if outcome == :reused
      raise Invalid unless outcome == :ok

      issue(record.user, record.family_id)
    end

    def self.revoke_family(family_id)
      RefreshToken.where(family_id:, revoked_at: nil).update_all(revoked_at: Time.current, updated_at: Time.current)
    end

    def self.issue(user, family_id)
      raw = SecureRandom.urlsafe_base64(48)
      RefreshToken.create!(user:, family_id:, token_digest: digest(raw), expires_at: REFRESH_TTL.from_now)
      access_token, expires_at = AccessTokens.issue(user, session_id: family_id)
      { access_token:, refresh_token: raw, expires_at: }
    end
    private_class_method :issue
  end
end
