# A patient's plan as the app shows it, with today's doses and goals and the
# last seven days of adherence, all in the clinic time zone.
class CarePlanView
  def initialize(plan, now: Time.current)
    @plan = plan
    @now = now
    @today = now.in_time_zone(Scheduling::Slots.zone).to_date
  end

  def as_json(*)
    doses = @plan.doses.to_a
    taken_today = DoseLog.where(care_dose_id: doses.map(&:id), taken_on: @today).index_by(&:care_dose_id)
    done_today = GoalLog.where(care_goal_id: @plan.goals.map(&:id), done_on: @today).pluck(:care_goal_id).to_set
    {
      id: @plan.id,
      programName: @plan.program_name,
      week: week,
      totalWeeks: @plan.total_weeks,
      progressPercent: progress,
      doctor: Presenters.doctor_summary(@plan.doctor),
      nextReviewAt: Presenters.time(@plan.next_review_at),
      milestones: milestones(doses, done_today),
      doses: doses.map { |dose| dose_json(dose, taken_today[dose.id]) },
      goals: @plan.goals.map { |goal| { id: goal.id, title: goal.title, detail: goal.detail, done: done_today.include?(goal.id) } },
      weekAdherence: adherence(doses),
      notes: @plan.notes.map { |note| Presenters.note(note) }
    }
  end

  def summary
    json = as_json
    json.slice(:programName, :week, :totalWeeks, :progressPercent, :milestones)
  end

  def next_dose
    taken = DoseLog.where(care_dose_id: @plan.doses.map(&:id), taken_on: @today).pluck(:care_dose_id).to_set
    pending = @plan.doses.reject { |dose| taken.include?(dose.id) }
    { dose: pending.first && dose_json(pending.first, nil), remaining: pending.size }
  end

  private

  def days_in = (@today - @plan.starts_on).to_i

  def week = (days_in / 7 + 1).clamp(1, @plan.total_weeks)

  def progress = ((days_in + 1) * 100 / (@plan.total_weeks * 7)).clamp(0, 100)

  def dose_json(dose, log)
    { id: dose.id, medicine: dose.medicine, instruction: dose.instruction, slot: dose.slot, time: dose.time_of_day,
      takenAt: Presenters.time(log&.taken_at) }
  end

  def adherence(doses)
    days = (0..6).map { |offset| @today - (6 - offset) }
    counts = DoseLog.where(care_dose_id: doses.map(&:id), taken_on: days).group(:taken_on).count
    days.map do |day|
      { date: Presenters.time(Scheduling::Slots.zone.local(day.year, day.month, day.day)), taken: counts.fetch(day, 0), total: doses.size }
    end
  end

  def milestones(doses, done_today)
    week_rows = adherence(doses).first(6)
    expected = week_rows.sum { |row| row[:total] }
    rate = expected.zero? ? 0 : week_rows.sum { |row| row[:taken] }.to_f / expected
    upcoming = @plan.patient.appointments.where(status: "confirmed").where("ends_at > ?", @now).exists?
    goals = @plan.goals.size
    [
      { id: "herbal", label: rate >= 0.7 ? "Herbal care on track" : "Herbal care needs attention", state: rate >= 0.7 ? "done" : "in_progress" },
      { id: "lifestyle", label: "Lifestyle goals in progress",
        state: goals.positive? && done_today.size == goals ? "done" : "in_progress" },
      { id: "consultation", label: upcoming ? "Next consultation upcoming" : "Book your next consultation", state: "upcoming" }
    ]
  end
end
