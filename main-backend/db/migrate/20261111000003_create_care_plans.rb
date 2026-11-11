class CreateCarePlans < ActiveRecord::Migration[8.1]
  def change
    create_table :care_plans, id: :uuid do |t|
      t.references :patient, type: :uuid, null: false, foreign_key: { to_table: :users }
      t.references :doctor, type: :uuid, null: false, foreign_key: true
      t.string :program_name, null: false, limit: 80
      t.date :starts_on, null: false
      t.integer :total_weeks, null: false
      t.datetime :next_review_at
      t.string :status, null: false, default: "active", limit: 16
      t.timestamps
    end
    add_index :care_plans, :patient_id, unique: true, where: "status = 'active'", name: "idx_care_plans_one_active"

    create_table :care_doses, id: :uuid do |t|
      t.references :care_plan, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :medicine, null: false, limit: 120
      t.string :instruction, null: false, limit: 160
      t.string :slot, null: false, limit: 16
      t.string :time_of_day, null: false, limit: 5
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_check_constraint :care_doses, "slot IN ('morning', 'afternoon', 'night')", name: "care_doses_valid_slot"

    # One row per dose per day it was taken, so history and adherence are kept.
    create_table :dose_logs, id: :uuid do |t|
      t.references :care_dose, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.date :taken_on, null: false
      t.datetime :taken_at, null: false
      t.timestamps
    end
    add_index :dose_logs, [:care_dose_id, :taken_on], unique: true

    create_table :care_goals, id: :uuid do |t|
      t.references :care_plan, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false, limit: 120
      t.string :detail, limit: 200
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    create_table :goal_logs, id: :uuid do |t|
      t.references :care_goal, type: :uuid, null: false, foreign_key: { on_delete: :cascade }
      t.date :done_on, null: false
      t.timestamps
    end
    add_index :goal_logs, [:care_goal_id, :done_on], unique: true

    # Follow-up guidance the doctor chose to share with the patient.
    create_table :care_notes, id: :uuid do |t|
      t.references :care_plan, type: :uuid, foreign_key: { on_delete: :cascade }
      t.references :appointment, type: :uuid, foreign_key: true
      t.string :title, null: false, limit: 120
      t.text :body, null: false
      t.datetime :shared_at, null: false
      t.timestamps
    end
  end
end
