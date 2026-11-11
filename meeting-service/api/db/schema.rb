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

ActiveRecord::Schema[8.1].define(version: 2026_11_10_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "idempotency_keys", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "scope", limit: 200, null: false
    t.string "key_digest", limit: 64, null: false
    t.string "request_digest", limit: 64, null: false
    t.integer "response_status"
    t.jsonb "response_body"
    t.datetime "completed_at"
    t.datetime "expires_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["expires_at"], name: "index_idempotency_keys_on_expires_at"
    t.index ["scope", "key_digest"], name: "idx_idempotency_keys_scope_digest", unique: true
  end

  create_table "meetings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "external_appointment_reference", limit: 160, null: false
    t.string "room_name", limit: 128, null: false
    t.string "meeting_type", default: "one_to_one", null: false
    t.string "status", default: "scheduled", null: false
    t.datetime "started_at"
    t.datetime "ended_at"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["external_appointment_reference"], name: "idx_meetings_active_appointment_reference", unique: true, where: "((status)::text <> ALL ((ARRAY['ended'::character varying, 'cancelled'::character varying, 'failed'::character varying])::text[]))"
    t.index ["room_name"], name: "index_meetings_on_room_name", unique: true
    t.check_constraint "meeting_type::text = 'one_to_one'::text", name: "meetings_one_to_one_only"
    t.check_constraint "status::text = ANY (ARRAY['scheduled'::character varying, 'ready'::character varying, 'in_progress'::character varying, 'ended'::character varying, 'cancelled'::character varying, 'failed'::character varying]::text[])", name: "meetings_valid_status"
  end

  create_table "outbox_messages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "topic", limit: 80, null: false
    t.jsonb "payload", default: {}, null: false
    t.integer "attempts", default: 0, null: false
    t.datetime "next_attempt_at", null: false
    t.datetime "completed_at"
    t.datetime "failed_at"
    t.string "last_error", limit: 500
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["completed_at"], name: "index_outbox_messages_on_completed_at"
    t.index ["next_attempt_at"], name: "idx_outbox_messages_pending", where: "((completed_at IS NULL) AND (failed_at IS NULL))"
    t.check_constraint "topic::text = ANY (ARRAY['meeting_event'::character varying, 'livekit_room_cleanup'::character varying]::text[])", name: "outbox_messages_valid_topic"
  end

  create_table "participants", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "meeting_id", null: false
    t.string "role", limit: 24, null: false
    t.string "external_user_reference", limit: 160, null: false
    t.string "display_name", limit: 120
    t.string "livekit_identity", limit: 128, null: false
    t.datetime "joined_at"
    t.datetime "left_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["livekit_identity"], name: "index_participants_on_livekit_identity", unique: true
    t.index ["meeting_id", "external_user_reference"], name: "idx_participants_meeting_external_user", unique: true
    t.index ["meeting_id", "role"], name: "index_participants_on_meeting_id_and_role", unique: true
    t.index ["meeting_id"], name: "index_participants_on_meeting_id"
    t.check_constraint "role::text = ANY (ARRAY['doctor'::character varying, 'patient'::character varying]::text[])", name: "participants_valid_role"
  end

  create_table "webhook_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "event_id", limit: 160, null: false
    t.string "event_name", limit: 80, null: false
    t.string "room_name", limit: 128
    t.string "participant_identity", limit: 128
    t.datetime "occurred_at"
    t.jsonb "payload", default: {}, null: false
    t.datetime "processed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["event_id"], name: "index_webhook_events_on_event_id", unique: true
    t.index ["room_name", "occurred_at"], name: "index_webhook_events_on_room_name_and_occurred_at"
  end

  add_foreign_key "participants", "meetings", on_delete: :cascade
end
