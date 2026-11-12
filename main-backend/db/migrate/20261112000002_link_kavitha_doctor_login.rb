class LinkKavithaDoctorLogin < ActiveRecord::Migration[8.1]
  def up
    doctor = Doctor.find_by(registration_number: "TNSIDDHA-02317")
    return unless doctor

    user = User.find_or_initialize_by(phone: "+919600678205")
    user.role = "doctor"
    user.name = "Dr. Kavitha Raman"
    user.save!
    doctor.update!(user: user)
  end

  def down
    doctor = Doctor.find_by(registration_number: "TNSIDDHA-02317")
    doctor&.update!(user: nil)
  end
end
