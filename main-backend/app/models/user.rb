class User < ApplicationRecord
  PHONE_FORMAT = /\A\+91[6-9]\d{9}\z/

  has_many :refresh_tokens, dependent: :delete_all
  has_many :appointments, foreign_key: :patient_id, inverse_of: :patient, dependent: :restrict_with_exception
  has_many :care_plans, foreign_key: :patient_id, inverse_of: :patient, dependent: :restrict_with_exception
  has_many :orders, foreign_key: :patient_id, inverse_of: :patient, dependent: :restrict_with_exception
  has_many :notifications, dependent: :delete_all
  has_one :doctor, dependent: :nullify

  enum :role, { patient: "patient", doctor: "doctor", admin: "admin" }, prefix: :role

  validates :phone, presence: true, format: { with: PHONE_FORMAT }, uniqueness: true
  validates :name, length: { maximum: 60 }, allow_nil: true
  validates :email, length: { maximum: 254 }, format: { with: /\A[^\s@]+@[^\s@]+\.[^\s@]{2,}\z/ }, allow_blank: true
  validates :city, length: { maximum: 60 }, allow_nil: true

  def first_name
    name.to_s.split.first.presence || ""
  end

  def active_care_plan
    care_plans.find_by(status: "active")
  end
end
