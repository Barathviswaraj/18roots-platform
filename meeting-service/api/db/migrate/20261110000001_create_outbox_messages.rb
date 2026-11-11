class CreateOutboxMessages < ActiveRecord::Migration[8.1]
  def change
    # Work that must happen after a database change: events for the main
    # backend and LiveKit room cleanup. Rows are written in the same transaction
    # as the change, then delivered and retried by OutboxDispatchJob.
    create_table :outbox_messages, id: :uuid do |t|
      t.string :topic, null: false, limit: 80
      t.jsonb :payload, null: false, default: {}
      t.integer :attempts, null: false, default: 0
      t.datetime :next_attempt_at, null: false
      t.datetime :completed_at
      t.datetime :failed_at
      t.string :last_error, limit: 500
      t.timestamps
    end
    add_index :outbox_messages, :next_attempt_at,
              where: "completed_at IS NULL AND failed_at IS NULL",
              name: "idx_outbox_messages_pending"
    add_index :outbox_messages, :completed_at
    add_check_constraint :outbox_messages,
                         "topic IN ('meeting_event', 'livekit_room_cleanup')",
                         name: "outbox_messages_valid_topic"
  end
end
