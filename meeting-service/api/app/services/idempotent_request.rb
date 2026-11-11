class IdempotentRequest
  class MissingKey < StandardError; end
  class KeyConflict < StandardError; end

  KEY_PATTERN = /\A[A-Za-z0-9._:-]{16,128}\z/

  def initialize(scope:, key:, payload:)
    @scope = scope
    @key = key.to_s
    @payload = canonicalize(payload)
  end

  def call
    raise MissingKey unless KEY_PATTERN.match?(@key)

    response = nil
    IdempotencyKey.transaction do
      record = IdempotencyKey.create_or_find_by!(scope: @scope, key_digest: digest(@key)) do |item|
        item.request_digest = digest(@payload)
        item.expires_at = 30.days.from_now
      end

      record.with_lock do
        raise KeyConflict unless secure_digest_match?(record.request_digest, digest(@payload))

        if record.response_status.present?
          response = { status: record.response_status, body: record.response_body }
        else
          response = yield
          record.update!(
            response_status: response.fetch(:status),
            response_body: response.fetch(:body),
            completed_at: Time.current
          )
        end
      end
    end
    response
  end

  private

  def digest(value)
    Digest::SHA256.hexdigest(value.to_s)
  end

  def secure_digest_match?(left, right)
    left.present? && ActiveSupport::SecurityUtils.secure_compare(left, right)
  end

  def canonicalize(value)
    case value
    when ActionController::Parameters
      canonicalize(value.to_unsafe_h)
    when Hash
      value.to_h.transform_keys(&:to_s).sort.to_h.transform_values { |item| canonicalize(item) }
    when Array
      value.map { |item| canonicalize(item) }
    else
      value
    end
  end
end

