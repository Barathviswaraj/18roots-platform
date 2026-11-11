class CreateAccounts < ActiveRecord::Migration[8.1]
  def change
    create_table :users, id: :uuid do |t|
      t.string :phone, null: false, limit: 16
      t.string :name, limit: 60
      t.string :email, limit: 254
      t.date :date_of_birth
      t.string :city, limit: 60
      t.string :avatar_url
      t.string :role, null: false, default: "patient", limit: 16
      t.datetime :last_sign_in_at
      t.timestamps
    end
    add_index :users, :phone, unique: true
    add_check_constraint :users, "role IN ('patient', 'doctor', 'admin')", name: "users_valid_role"

    # One row per code sent. Only a keyed hash of the code is stored.
    create_table :otp_challenges, id: :uuid do |t|
      t.string :phone, null: false, limit: 16
      t.string :code_digest, null: false, limit: 64
      t.datetime :expires_at, null: false
      t.integer :attempts, null: false, default: 0
      t.datetime :consumed_at
      t.string :request_ip, limit: 64
      t.timestamps
    end
    add_index :otp_challenges, [:phone, :created_at]

    # Refresh tokens rotate on every use. Reusing an old one revokes its whole
    # family, which cuts off a stolen token.
    create_table :refresh_tokens, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :token_digest, null: false, limit: 64
      t.uuid :family_id, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.datetime :used_at
      t.timestamps
    end
    add_index :refresh_tokens, :token_digest, unique: true
    add_index :refresh_tokens, :family_id

    # Who did what to which record. Required for clinical data, refunds and
    # cancellations by the architecture guide.
    create_table :audit_events, id: :uuid do |t|
      t.uuid :actor_id
      t.string :action, null: false, limit: 80
      t.string :subject_type, limit: 40
      t.uuid :subject_id
      t.jsonb :metadata, null: false, default: {}
      t.string :ip, limit: 64
      t.datetime :created_at, null: false
    end
    add_index :audit_events, [:subject_type, :subject_id]
    add_index :audit_events, [:actor_id, :created_at]
  end
end
