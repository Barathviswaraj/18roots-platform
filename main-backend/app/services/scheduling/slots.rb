module Scheduling
  # Bookable times from a doctor's weekly hours, in the clinic time zone.
  # The phone only sees a snapshot: Bookings rechecks a slot before holding it.
  class Slots
    Slot = Data.define(:id, :starts_at, :ends_at, :available)
    BOOKING_LEAD_TIME = 30.minutes
    SEARCH_DAYS = 14

    def self.zone = Time.find_zone!(Rails.application.config.x.clinic_time_zone)

    def self.slot_id(doctor, starts_at) = "#{doctor.id}_#{starts_at.utc.iso8601(3)}"

    def self.parse_id(slot_id)
      doctor_id, iso = slot_id.to_s.split("_", 2)
      [doctor_id, Time.iso8601(iso.to_s)]
    rescue ArgumentError
      [nil, nil]
    end

    def self.for_day(doctor, date, now: Time.current)
      day = zone.local(date.year, date.month, date.day)
      rules = doctor.availability_rules.select { |rule| rule.weekday == day.wday }
      starts = rules.flat_map do |rule|
        (rule.start_minute...rule.end_minute).step(doctor.consultation_minutes).filter_map do |minute|
          next if minute + doctor.consultation_minutes > rule.end_minute

          day + minute.minutes
        end
      end.sort
      starts = starts.select { |time| time >= now + BOOKING_LEAD_TIME }
      return [] if starts.empty?

      taken = taken_starts(doctor, starts.first, starts.last, now)
      starts.map do |time|
        Slot.new(
          id: slot_id(doctor, time),
          starts_at: time.utc,
          ends_at: (time + doctor.consultation_minutes.minutes).utc,
          available: !taken.include?(time.utc.to_i)
        )
      end
    end

    def self.next_available(doctor, now: Time.current)
      today = now.in_time_zone(zone).to_date
      (0...SEARCH_DAYS).each do |offset|
        slot = for_day(doctor, today + offset, now:).find(&:available)
        return slot.starts_at if slot
      end
      nil
    end

    # Is this exact time one the doctor offers and still free?
    def self.bookable?(doctor, starts_at, now: Time.current)
      date = starts_at.in_time_zone(zone).to_date
      for_day(doctor, date, now:).any? { |slot| slot.starts_at.to_i == starts_at.to_i && slot.available }
    end

    def self.taken_starts(doctor, from, to, now)
      doctor.appointments
            .where(starts_at: from..to, status: Appointment::ACTIVE_STATUSES)
            .where("status <> 'held' OR hold_expires_at > ?", now)
            .pluck(:starts_at).map(&:to_i).to_set
    end
    private_class_method :taken_starts
  end
end
