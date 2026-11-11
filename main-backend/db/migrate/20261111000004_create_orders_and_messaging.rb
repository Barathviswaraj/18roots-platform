class CreateOrdersAndMessaging < ActiveRecord::Migration[8.1]
  def change
    create_table :orders, id: :uuid do |t|
      t.references :patient, type: :uuid, null: false, foreign_key: { to_table: :users }
      t.string :number, null: false, limit: 20
      t.string :status, null: false, default: "placed", limit: 20
      t.datetime :placed_at, null: false
      t.datetime :expected_at
      t.datetime :delivered_at
      t.integer :total, null: false
      t.string :payment_method, null: false, limit: 60
      t.jsonb :address, null: false, default: {}
      t.timestamps
    end
    add_index :orders, :number, unique: true
    add_check_constraint :orders,
                         "status IN ('placed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')",
                         name: "orders_valid_status"

    create_table :order_items, id: :uuid do |t|
      t.references :order, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false, limit: 120
      t.integer :quantity, null: false
      t.integer :unit_price, null: false
      t.timestamps
    end

    create_table :order_events, id: :uuid do |t|
      t.references :order, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :status, null: false, limit: 20
      t.datetime :at, null: false
      t.timestamps
    end
    add_index :order_events, [:order_id, :status], unique: true

    create_table :notifications, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false, limit: 120
      t.string :body, null: false, limit: 300
      t.string :link, limit: 200
      t.datetime :read_at
      t.timestamps
    end
    add_index :notifications, [:user_id, :created_at]

    # Events from the meeting and payment services, stored once by ID.
    create_table :webhook_events, id: :uuid do |t|
      t.string :source, null: false, limit: 20
      t.string :event_id, null: false, limit: 120
      t.string :event_type, null: false, limit: 60
      t.datetime :occurred_at
      t.timestamps
    end
    add_index :webhook_events, [:source, :event_id], unique: true

    # Calls to other services, saved in the same transaction as the change that
    # needs them and delivered with retries by OutboxDispatchJob.
    create_table :outbox_messages, id: :uuid do |t|
      t.string :topic, null: false, limit: 40
      t.jsonb :payload, null: false, default: {}
      t.integer :attempts, null: false, default: 0
      t.datetime :next_attempt_at, null: false
      t.datetime :completed_at
      t.datetime :failed_at
      t.string :last_error, limit: 500
      t.timestamps
    end
    add_index :outbox_messages, :next_attempt_at, where: "completed_at IS NULL AND failed_at IS NULL",
              name: "idx_outbox_messages_pending"
    add_check_constraint :outbox_messages,
                         "topic IN ('meeting_create', 'meeting_cancel', 'payment_refund')",
                         name: "outbox_messages_valid_topic"
  end
end
