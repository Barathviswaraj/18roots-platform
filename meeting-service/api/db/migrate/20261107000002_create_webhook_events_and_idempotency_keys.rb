class CreateWebhookEventsAndIdempotencyKeys < ActiveRecord::Migration[8.1]
  def change
    create_table :webhook_events, id: :uuid do |t|
      t.string :event_id, null: false, limit: 160
      t.string :event_name, null: false, limit: 80
      t.string :room_name, limit: 128
      t.string :participant_identity, limit: 128
      t.datetime :occurred_at
      t.jsonb :payload, null: false, default: {}
      t.datetime :processed_at
      t.timestamps
    end
    add_index :webhook_events, :event_id, unique: true
    add_index :webhook_events, [:room_name, :occurred_at]

    create_table :idempotency_keys, id: :uuid do |t|
      t.string :scope, null: false, limit: 200
      t.string :key_digest, null: false, limit: 64
      t.string :request_digest, null: false, limit: 64
      t.integer :response_status
      t.jsonb :response_body
      t.datetime :completed_at
      t.datetime :expires_at, null: false
      t.timestamps
    end
    add_index :idempotency_keys, [:scope, :key_digest], unique: true,
              name: "idx_idempotency_keys_scope_digest"
    add_index :idempotency_keys, :expires_at
  end
end

