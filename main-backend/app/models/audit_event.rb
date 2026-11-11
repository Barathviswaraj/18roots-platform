class AuditEvent < ApplicationRecord
  def self.record!(action:, actor: nil, subject: nil, metadata: {}, ip: nil)
    create!(
      action:,
      actor_id: actor&.id,
      subject_type: subject&.class&.name,
      subject_id: subject&.id,
      metadata:,
      ip:,
      created_at: Time.current
    )
  end
end
