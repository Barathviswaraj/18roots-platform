class CreateScheduling < ActiveRecord::Migration[8.1]
  def change
    create_table :doctors, id: :uuid do |t|
      t.references :user, type: :uuid, foreign_key: true, index: { unique: true }
      t.string :name, null: false, limit: 80
      t.string :title, null: false, limit: 80
      t.string :photo_url
      t.datetime :verified_at
      t.string :registration_number, null: false, limit: 40
      t.string :qualifications, array: true, null: false, default: []
      t.integer :experience_years, null: false, default: 0
      t.string :languages, array: true, null: false, default: []
      t.string :specialties, array: true, null: false, default: []
      t.integer :fee_amount, null: false
      t.integer :consultation_minutes, null: false, default: 30
      t.decimal :rating, precision: 2, scale: 1
      t.text :about, null: false, default: ""
      t.text :cancellation_policy, null: false
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_check_constraint :doctors, "fee_amount >= 0", name: "doctors_fee_not_negative"

    # Weekly working hours in the clinic time zone. Slots are generated from these.
    create_table :availability_rules, id: :uuid do |t|
      t.references :doctor, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.integer :weekday, null: false
      t.integer :start_minute, null: false
      t.integer :end_minute, null: false
      t.timestamps
    end
    add_check_constraint :availability_rules, "weekday BETWEEN 0 AND 6", name: "availability_valid_weekday"
    add_check_constraint :availability_rules, "start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute",
                         name: "availability_valid_window"

    # The appointment itself. Payment and the video consultation have their own
    # statuses, as the guide asks, so one cannot overwrite another.
    create_table :appointments, id: :uuid do |t|
      t.references :patient, type: :uuid, null: false, foreign_key: { to_table: :users }
      t.references :doctor, type: :uuid, null: false, foreign_key: true
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.string :status, null: false, default: "held", limit: 16
      t.datetime :hold_expires_at
      t.string :reason, limit: 500
      t.datetime :consent_accepted_at
      t.string :consent_version, limit: 20
      t.datetime :cancelled_at
      t.string :cancelled_by, limit: 16
      t.uuid :meeting_id
      t.string :consultation_status, null: false, default: "not_created", limit: 16
      t.datetime :started_at
      t.datetime :ended_at
      t.datetime :doctor_joined_at
      t.datetime :patient_joined_at
      t.string :ended_by, limit: 16
      t.boolean :needs_review, null: false, default: false
      t.timestamps
    end
    add_check_constraint :appointments,
                         "status IN ('held', 'confirmed', 'completed', 'missed', 'cancelled', 'expired')",
                         name: "appointments_valid_status"
    add_check_constraint :appointments,
                         "consultation_status IN ('not_created', 'scheduled', 'in_progress', 'ended', 'cancelled')",
                         name: "appointments_valid_consultation_status"
    add_check_constraint :appointments, "starts_at < ends_at", name: "appointments_valid_times"
    # The database itself refuses a second active appointment for the same
    # doctor and time, even if two requests race.
    add_index :appointments, [:doctor_id, :starts_at], unique: true,
              where: "status IN ('held', 'confirmed', 'completed')",
              name: "idx_appointments_one_active_per_slot"
    add_index :appointments, [:patient_id, :starts_at]
    add_index :appointments, :meeting_id, unique: true

    create_table :payments, id: :uuid do |t|
      t.references :appointment, type: :uuid, null: false, foreign_key: true, index: { unique: true }
      t.references :patient, type: :uuid, null: false, foreign_key: { to_table: :users }
      t.string :idempotency_key, null: false, limit: 128
      t.integer :amount, null: false
      t.string :currency, null: false, default: "INR", limit: 3
      t.string :status, null: false, default: "created", limit: 16
      t.string :provider, null: false, limit: 20
      t.string :provider_order_id, limit: 120
      t.string :provider_payment_id, limit: 120
      t.string :checkout_url
      t.datetime :paid_at
      t.integer :refund_amount
      t.datetime :refunded_at
      t.timestamps
    end
    add_index :payments, [:patient_id, :idempotency_key], unique: true
    add_index :payments, :provider_order_id, unique: true
    add_check_constraint :payments,
                         "status IN ('created', 'paid', 'failed', 'refund_pending', 'refunded')",
                         name: "payments_valid_status"
  end
end
