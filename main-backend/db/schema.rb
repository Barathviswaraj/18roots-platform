# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_11_000004) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "appointments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "patient_id", null: false
    t.uuid "doctor_id", null: false
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.string "status", limit: 16, default: "held", null: false
    t.datetime "hold_expires_at"
    t.string "reason", limit: 500
    t.datetime "consent_accepted_at"
    t.string "consent_version", limit: 20
    t.datetime "cancelled_at"
    t.string "cancelled_by", limit: 16
    t.uuid "meeting_id"
    t.string "consultation_status", limit: 16, default: "not_created", null: false
    t.datetime "started_at"
    t.datetime "ended_at"
    t.datetime "doctor_joined_at"
    t.datetime "patient_joined_at"
    t.string "ended_by", limit: 16
    t.boolean "needs_review", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["doctor_id", "starts_at"], name: "idx_appointments_one_active_per_slot", unique: true, where: "((status)::text = ANY ((ARRAY['held'::character varying, 'confirmed'::character varying, 'completed'::character varying])::text[]))"
    t.index ["doctor_id"], name: "index_appointments_on_doctor_id"
    t.index ["meeting_id"], name: "index_appointments_on_meeting_id", unique: true
    t.index ["patient_id", "starts_at"], name: "index_appointments_on_patient_id_and_starts_at"
    t.index ["patient_id"], name: "index_appointments_on_patient_id"
    t.check_constraint "consultation_status::text = ANY (ARRAY['not_created'::character varying, 'scheduled'::character varying, 'in_progress'::character varying, 'ended'::character varying, 'cancelled'::character varying]::text[])", name: "appointments_valid_consultation_status"
    t.check_constraint "starts_at < ends_at", name: "appointments_valid_times"
    t.check_constraint "status::text = ANY (ARRAY['held'::character varying, 'confirmed'::character varying, 'completed'::character varying, 'missed'::character varying, 'cancelled'::character varying, 'expired'::character varying]::text[])", name: "appointments_valid_status"
  end

  create_table "audit_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "actor_id"
    t.string "action", limit: 80, null: false
    t.string "subject_type", limit: 40
    t.uuid "subject_id"
    t.jsonb "metadata", default: {}, null: false
    t.string "ip", limit: 64
    t.datetime "created_at", null: false
    t.index ["actor_id", "created_at"], name: "index_audit_events_on_actor_id_and_created_at"
    t.index ["subject_type", "subject_id"], name: "index_audit_events_on_subject_type_and_subject_id"
  end

  create_table "availability_rules", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "doctor_id", null: false
    t.integer "weekday", null: false
    t.integer "start_minute", null: false
    t.integer "end_minute", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["doctor_id"], name: "index_availability_rules_on_doctor_id"
    t.check_constraint "start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute", name: "availability_valid_window"
    t.check_constraint "weekday >= 0 AND weekday <= 6", name: "availability_valid_weekday"
  end

  create_table "care_doses", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "care_plan_id", null: false
    t.string "medicine", limit: 120, null: false
    t.string "instruction", limit: 160, null: false
    t.string "slot", limit: 16, null: false
    t.string "time_of_day", limit: 5, null: false
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["care_plan_id"], name: "index_care_doses_on_care_plan_id"
    t.check_constraint "slot::text = ANY (ARRAY['morning'::character varying, 'afternoon'::character varying, 'night'::character varying]::text[])", name: "care_doses_valid_slot"
  end

  create_table "care_goals", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "care_plan_id", null: false
    t.string "title", limit: 120, null: false
    t.string "detail", limit: 200
    t.integer "position", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["care_plan_id"], name: "index_care_goals_on_care_plan_id"
  end

  create_table "care_notes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "care_plan_id"
    t.uuid "appointment_id"
    t.string "title", limit: 120, null: false
    t.text "body", null: false
    t.datetime "shared_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["appointment_id"], name: "index_care_notes_on_appointment_id"
    t.index ["care_plan_id"], name: "index_care_notes_on_care_plan_id"
  end

  create_table "care_plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "patient_id", null: false
    t.uuid "doctor_id", null: false
    t.string "program_name", limit: 80, null: false
    t.date "starts_on", null: false
    t.integer "total_weeks", null: false
    t.datetime "next_review_at"
    t.string "status", limit: 16, default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["doctor_id"], name: "index_care_plans_on_doctor_id"
    t.index ["patient_id"], name: "idx_care_plans_one_active", unique: true, where: "((status)::text = 'active'::text)"
    t.index ["patient_id"], name: "index_care_plans_on_patient_id"
  end

  create_table "doctors", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id"
    t.string "name", limit: 80, null: false
    t.string "title", limit: 80, null: false
    t.string "photo_url"
    t.datetime "verified_at"
    t.string "registration_number", limit: 40, null: false
    t.string "qualifications", default: [], null: false, array: true
    t.integer "experience_years", default: 0, null: false
    t.string "languages", default: [], null: false, array: true
    t.string "specialties", default: [], null: false, array: true
    t.integer "fee_amount", null: false
    t.integer "consultation_minutes", default: 30, null: false
    t.decimal "rating", precision: 2, scale: 1
    t.text "about", default: "", null: false
    t.text "cancellation_policy", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_doctors_on_user_id", unique: true
    t.check_constraint "fee_amount >= 0", name: "doctors_fee_not_negative"
  end

  create_table "dose_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "care_dose_id", null: false
    t.date "taken_on", null: false
    t.datetime "taken_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["care_dose_id", "taken_on"], name: "index_dose_logs_on_care_dose_id_and_taken_on", unique: true
    t.index ["care_dose_id"], name: "index_dose_logs_on_care_dose_id"
  end

  create_table "goal_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "care_goal_id", null: false
    t.date "done_on", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["care_goal_id", "done_on"], name: "index_goal_logs_on_care_goal_id_and_done_on", unique: true
    t.index ["care_goal_id"], name: "index_goal_logs_on_care_goal_id"
  end

  create_table "notifications", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "title", limit: 120, null: false
    t.string "body", limit: 300, null: false
    t.string "link", limit: 200
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "created_at"], name: "index_notifications_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_notifications_on_user_id"
  end

  create_table "order_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "order_id", null: false
    t.string "status", limit: 20, null: false
    t.datetime "at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id", "status"], name: "index_order_events_on_order_id_and_status", unique: true
    t.index ["order_id"], name: "index_order_events_on_order_id"
  end

  create_table "order_items", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "order_id", null: false
    t.string "name", limit: 120, null: false
    t.integer "quantity", null: false
    t.integer "unit_price", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_order_items_on_order_id"
  end

  create_table "orders", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "patient_id", null: false
    t.string "number", limit: 20, null: false
    t.string "status", limit: 20, default: "placed", null: false
    t.datetime "placed_at", null: false
    t.datetime "expected_at"
    t.datetime "delivered_at"
    t.integer "total", null: false
    t.string "payment_method", limit: 60, null: false
    t.jsonb "address", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["number"], name: "index_orders_on_number", unique: true
    t.index ["patient_id"], name: "index_orders_on_patient_id"
    t.check_constraint "status::text = ANY (ARRAY['placed'::character varying, 'packed'::character varying, 'shipped'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'cancelled'::character varying]::text[])", name: "orders_valid_status"
  end

  create_table "otp_challenges", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "phone", limit: 16, null: false
    t.string "code_digest", limit: 64, null: false
    t.datetime "expires_at", null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "consumed_at"
    t.string "request_ip", limit: 64
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["phone", "created_at"], name: "index_otp_challenges_on_phone_and_created_at"
  end

  create_table "outbox_messages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "topic", limit: 40, null: false
    t.jsonb "payload", default: {}, null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "next_attempt_at", null: false
    t.datetime "completed_at"
    t.datetime "failed_at"
    t.string "last_error", limit: 500
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["next_attempt_at"], name: "idx_outbox_messages_pending", where: "((completed_at IS NULL) AND (failed_at IS NULL))"
    t.check_constraint "topic::text = ANY (ARRAY['meeting_create'::character varying, 'meeting_cancel'::character varying, 'payment_refund'::character varying]::text[])", name: "outbox_messages_valid_topic"
  end

  create_table "payments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "appointment_id", null: false
    t.uuid "patient_id", null: false
    t.string "idempotency_key", limit: 128, null: false
    t.integer "amount", null: false
    t.string "currency", limit: 3, default: "INR", null: false
    t.string "status", limit: 16, default: "created", null: false
    t.string "provider", limit: 20, null: false
    t.string "provider_order_id", limit: 120
    t.string "provider_payment_id", limit: 120
    t.string "checkout_url"
    t.datetime "paid_at"
    t.integer "refund_amount"
    t.datetime "refunded_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["appointment_id"], name: "index_payments_on_appointment_id", unique: true
    t.index ["patient_id", "idempotency_key"], name: "index_payments_on_patient_id_and_idempotency_key", unique: true
    t.index ["patient_id"], name: "index_payments_on_patient_id"
    t.index ["provider_order_id"], name: "index_payments_on_provider_order_id", unique: true
    t.check_constraint "status::text = ANY (ARRAY['created'::character varying, 'paid'::character varying, 'failed'::character varying, 'refund_pending'::character varying, 'refunded'::character varying]::text[])", name: "payments_valid_status"
  end

  create_table "refresh_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "token_digest", limit: 64, null: false
    t.uuid "family_id", null: false
    t.datetime "expires_at", null: false
    t.datetime "revoked_at"
    t.datetime "used_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["family_id"], name: "index_refresh_tokens_on_family_id"
    t.index ["token_digest"], name: "index_refresh_tokens_on_token_digest", unique: true
    t.index ["user_id"], name: "index_refresh_tokens_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "phone", limit: 16, null: false
    t.string "name", limit: 60
    t.string "email", limit: 254
    t.date "date_of_birth"
    t.string "city", limit: 60
    t.string "avatar_url"
    t.string "role", limit: 16, default: "patient", null: false
    t.datetime "last_sign_in_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["phone"], name: "index_users_on_phone", unique: true
    t.check_constraint "role::text = ANY (ARRAY['patient'::character varying, 'doctor'::character varying, 'admin'::character varying]::text[])", name: "users_valid_role"
  end

  create_table "webhook_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "source", limit: 20, null: false
    t.string "event_id", limit: 120, null: false
    t.string "event_type", limit: 60, null: false
    t.datetime "occurred_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["source", "event_id"], name: "index_webhook_events_on_source_and_event_id", unique: true
  end

  add_foreign_key "appointments", "doctors"
  add_foreign_key "appointments", "users", column: "patient_id"
  add_foreign_key "availability_rules", "doctors", on_delete: :cascade
  add_foreign_key "care_doses", "care_plans", on_delete: :cascade
  add_foreign_key "care_goals", "care_plans", on_delete: :cascade
  add_foreign_key "care_notes", "appointments"
  add_foreign_key "care_notes", "care_plans", on_delete: :cascade
  add_foreign_key "care_plans", "doctors"
  add_foreign_key "care_plans", "users", column: "patient_id"
  add_foreign_key "doctors", "users"
  add_foreign_key "dose_logs", "care_doses", on_delete: :cascade
  add_foreign_key "goal_logs", "care_goals", on_delete: :cascade
  add_foreign_key "notifications", "users", on_delete: :cascade
  add_foreign_key "order_events", "orders", on_delete: :cascade
  add_foreign_key "order_items", "orders", on_delete: :cascade
  add_foreign_key "orders", "users", column: "patient_id"
  add_foreign_key "payments", "appointments"
  add_foreign_key "payments", "users", column: "patient_id"
  add_foreign_key "refresh_tokens", "users", on_delete: :cascade
end
