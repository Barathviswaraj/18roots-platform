class CreateMeetingsAndParticipants < ActiveRecord::Migration[8.1]
  def change
    create_table :meetings, id: :uuid do |t|
      t.string :external_appointment_reference, null: false, limit: 160
      t.string :room_name, null: false, limit: 128
      t.string :meeting_type, null: false, default: "one_to_one"
      t.string :status, null: false, default: "scheduled"
      t.datetime :started_at
      t.datetime :ended_at
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end
    add_index :meetings, :room_name, unique: true
    add_index :meetings, :external_appointment_reference,
              unique: true,
              where: "status NOT IN ('ended', 'cancelled', 'failed')",
              name: "idx_meetings_active_appointment_reference"
    add_check_constraint :meetings,
                         "meeting_type = 'one_to_one'",
                         name: "meetings_one_to_one_only"
    add_check_constraint :meetings,
                         "status IN ('scheduled', 'ready', 'in_progress', 'ended', 'cancelled', 'failed')",
                         name: "meetings_valid_status"

    create_table :participants, id: :uuid do |t|
      t.references :meeting, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :role, null: false, limit: 24
      t.string :external_user_reference, null: false, limit: 160
      t.string :display_name, limit: 120
      t.string :livekit_identity, null: false, limit: 128
      t.datetime :joined_at
      t.datetime :left_at
      t.timestamps
    end
    add_index :participants, :livekit_identity, unique: true
    add_index :participants, [:meeting_id, :role], unique: true
    add_index :participants, [:meeting_id, :external_user_reference], unique: true,
              name: "idx_participants_meeting_external_user"
    add_check_constraint :participants,
                         "role IN ('doctor', 'patient')",
                         name: "participants_valid_role"
  end
end

