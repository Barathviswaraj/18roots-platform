# Housekeeping every few minutes: release lapsed holds, mark consultations
# nobody attended, and remove expired login data and old records.
class MaintenanceJob < ApplicationJob
  queue_as :default

  def perform(now: Time.current)
    Appointment.where(status: "held").where(hold_expires_at: ..now).find_each(&:expire_hold!)

    # Confirmed, ended an hour ago, and the video room never started.
    Appointment.where(status: "confirmed", consultation_status: %w[not_created scheduled])
               .where(ends_at: ..(now - 1.hour)).find_each do |appointment|
      appointment.transition_to!("missed", needs_review: true)
    end

    OtpChallenge.where(created_at: ...(now - 1.day)).in_batches(of: 500).delete_all
    RefreshToken.where(expires_at: ...(now - 7.days)).in_batches(of: 500).delete_all
    WebhookEvent.where(created_at: ...(now - 90.days)).in_batches(of: 500).delete_all
    OutboxMessage.where(completed_at: ...(now - 30.days)).in_batches(of: 500).delete_all
  end
end
