# The home screen as a list of sections the app renders in order. Adding,
# hiding or reordering cards here needs no app release.
class HomeView
  MESSAGES = {
    "ta" => "சமநிலையான வாழ்வு ஒரு பயணம்; நீங்கள் நன்றாகச் செய்கிறீர்கள்",
    "en" => "A more balanced you is a journey, and you're doing so well"
  }.freeze

  def initialize(user, language:, now: Time.current)
    @user = user
    @language = language
    @now = now
  end

  def as_json(*)
    plan = @user.active_care_plan
    plan_view = plan && CarePlanView.new(plan, now: @now)
    sections = []
    sections << { type: "care_journey", id: "care-journey", data: plan_view.summary } if plan_view
    sections << { type: "upcoming_consultation", id: "next-consultation", data: { consultation: next_consultation } }
    sections << { type: "medicine_reminder", id: "medicine", data: plan_view.next_dose } if plan_view
    order = @user.orders.active.includes(:items, :events).order(placed_at: :desc).first
    sections << { type: "order_tracking", id: "order", data: { order: Presenters.order(order) } } if order

    {
      user: { name: @user.first_name, avatarUrl: @user.avatar_url },
      message: MESSAGES.fetch(@language, MESSAGES["en"]),
      unreadNotifications: @user.notifications.unread.count,
      sections:
    }
  end

  private

  def next_consultation
    appointment = @user.appointments.includes(:doctor, :care_notes)
                       .where(status: "confirmed").where("ends_at > ?", @now).order(:starts_at).first
    appointment && Presenters.consultation(appointment, now: @now)
  end
end
