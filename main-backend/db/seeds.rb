# Demo data: four verified doctors with weekly hours, and a demo patient
# (+919876543210) with a care plan, a past consultation and two orders.
# Names, registration numbers and medicines are illustrative, not medical advice.
# Safe to run more than once.

policy = "Free cancellation up to 6 hours before the start. After that, half the fee is refunded. " \
         "Missed consultations are not refunded."
weekday_hours = [[10 * 60, 13 * 60], [16 * 60, 19 * 60]]

doctors = [
  { name: "Dr. Meera Krishnan", title: "Siddha Physician", registration_number: "TNSIDDHA-04821",
    qualifications: ["BSMS", "MD (Siddha)"], experience_years: 11, languages: %w[Tamil English],
    specialties: ["PCOD", "Menstrual health", "Women's wellness"], fee_amount: 600, consultation_minutes: 30, rating: 4.9,
    about: "Focuses on PCOD and menstrual health through Siddha medicine, diet and daily routine." },
  { name: "Dr. Kavitha Raman", title: "Siddha Gynaecology Consultant", registration_number: "TNSIDDHA-02317",
    qualifications: ["BSMS", "MD (Siddha, Maruthuvam)"], experience_years: 15, languages: %w[Tamil English Malayalam],
    specialties: %w[Fertility PCOD Menopause], fee_amount: 800, consultation_minutes: 30, rating: 4.8,
    about: "Supports women through fertility planning, PCOD and menopause with classical Siddha care." },
  { name: "Dr. Anitha Selvam", title: "Siddha Physician", registration_number: "TNSIDDHA-06654",
    qualifications: ["BSMS"], experience_years: 7, languages: %w[Tamil],
    specialties: ["Thyroid", "Skin care", "Digestion"], fee_amount: 450, consultation_minutes: 20, rating: 4.7,
    about: "Treats thyroid, skin and digestive concerns with gentle Siddha formulations." },
  { name: "Dr. Priya Sundar", title: "Siddha Physician, Varmam and Yoga", registration_number: "TNSIDDHA-05109",
    qualifications: ["BSMS", "PG Diploma in Yoga"], experience_years: 9, languages: %w[Tamil English Hindi],
    specialties: ["Stress", "Sleep", "Back pain"], fee_amount: 500, consultation_minutes: 30, rating: 4.8,
    about: "Combines Varmam therapy and yoga to help with stress, sleep and chronic pain." }
].map do |attributes|
  doctor = Doctor.find_or_initialize_by(registration_number: attributes[:registration_number])
  doctor.update!(attributes.merge(verified_at: doctor.verified_at || Time.current, cancellation_policy: policy, active: true))
  if doctor.availability_rules.empty?
    (1..6).each do |weekday|
      weekday_hours.each { |from, to| doctor.availability_rules.create!(weekday:, start_minute: from, end_minute: to) }
    end
  end
  doctor
end
meera = doctors.first

patient = User.find_or_create_by!(phone: "+919876543210")
patient.update!(name: "Anika Raghavan", email: "anika@example.com", city: "Chennai", date_of_birth: Date.new(1996, 2, 14))

unless patient.active_care_plan
  zone = Time.find_zone!(Rails.application.config.x.clinic_time_zone)
  today = Time.current.in_time_zone(zone).to_date
  past = Appointment.create!(
    patient:, doctor: meera, starts_at: zone.local(today.year, today.month, today.day, 10, 30) - 14.days,
    ends_at: zone.local(today.year, today.month, today.day, 11, 0) - 14.days, status: "completed",
    consultation_status: "ended", reason: "Irregular cycles", consent_accepted_at: 15.days.ago, consent_version: "2026-11",
    doctor_joined_at: 14.days.ago, patient_joined_at: 14.days.ago
  )
  Payment.create!(appointment: past, patient:, idempotency_key: "seed-#{past.id}", amount: meera.fee_amount,
                  provider: "demo", status: "paid", paid_at: 15.days.ago, provider_order_id: "demo_seed_#{past.id}")

  plan = CarePlan.create!(patient:, doctor: meera, program_name: "PCOD Care Journey", starts_on: today - 35, total_weeks: 12)
  [
    ["Karisalankanni Churnam", "1 capsule after breakfast", "morning", "08:30"],
    ["Kumari Lehyam", "1 teaspoon before lunch", "afternoon", "12:30"],
    ["Sathavari Lehyam", "1 teaspoon with warm milk", "night", "21:00"]
  ].each_with_index do |(medicine, instruction, slot, time), position|
    dose = plan.doses.create!(medicine:, instruction:, slot:, time_of_day: time, position:)
    (1..6).each { |days_ago| dose.logs.create!(taken_on: today - days_ago, taken_at: (days_ago.days.ago)) unless (days_ago + position) % 5 == 0 }
  end
  [
    ["Walk for 30 minutes", "Morning or evening, at an easy pace"],
    ["Warm water on waking", nil],
    ["Baddha Konasana, 10 minutes", "Bound angle pose with slow breathing"],
    ["No refined sugar today", nil],
    ["Sleep by 10:30 PM", nil]
  ].each_with_index { |(title, detail), position| plan.goals.create!(title:, detail:, position:) }
  plan.notes.create!(appointment: past, title: "Daily routine",
                     body: "Eat breakfast before 9 AM and keep meal times regular. Walk for 30 minutes daily and sleep by 10:30 PM.",
                     shared_at: past.ends_at + 15.minutes)

  address = { name: "Anika Raghavan", line1: "12, Lotus Street, Anna Nagar", line2: nil, city: "Chennai", pincode: "600040" }
  active = Order.create!(patient:, number: "180524", status: "out_for_delivery", placed_at: 2.days.ago,
                         expected_at: zone.local(today.year, today.month, today.day, 19), total: 920,
                         payment_method: "UPI", address:)
  [["Karisalankanni Churnam, 100 g", 240], ["Kumari Lehyam, 200 g", 320], ["Sathavari Lehyam, 200 g", 360]].each do |name, price|
    active.items.create!(name:, quantity: 1, unit_price: price)
  end
  { "placed" => 2.days.ago, "packed" => 2.days.ago + 5.hours, "shipped" => 1.day.ago, "out_for_delivery" => 2.hours.ago }
    .each { |status, at| active.events.create!(status:, at:) }

  delivered = Order.create!(patient:, number: "180311", status: "delivered", placed_at: 33.days.ago, delivered_at: 30.days.ago,
                            total: 760, payment_method: "Card ending 4242", address:)
  delivered.items.create!(name: "Karisalankanni Churnam, 100 g", quantity: 2, unit_price: 240)
  delivered.items.create!(name: "Herbal hair oil, 100 ml", quantity: 1, unit_price: 280)
  { "placed" => 33.days.ago, "packed" => 33.days.ago + 4.hours, "shipped" => 32.days.ago,
    "out_for_delivery" => 30.days.ago - 5.hours, "delivered" => 30.days.ago }.each { |status, at| delivered.events.create!(status:, at:) }

  patient.notifications.create!(title: "Order out for delivery", body: "Order #180524 will arrive today.", link: "/orders/#{active.id}")
  patient.notifications.create!(title: "Your doctor shared a note", body: "Dr. Meera Krishnan added guidance to your care plan.",
                                link: "/care", read_at: 14.days.ago)
end

puts "Seeded #{Doctor.count} doctors and the demo patient #{patient.phone}" unless Rails.env.test?
