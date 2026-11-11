require "rails_helper"

RSpec.describe "Recurring jobs" do
  describe RecurringJobScheduler do
    it "enqueues each job only when its interval is claimed" do
      claimed = []
      scheduler = described_class.new(claim: lambda { |name, seconds|
        claimed << [name, seconds]
        name == "outbox-dispatch"
      })

      scheduler.tick

      expect(enqueued_jobs.map { |job| job[:job] }).to eq([OutboxDispatchJob])
      expect(claimed).to eq([["outbox-dispatch", 60], ["purge-expired-records", 3600]])
    end

    it "keeps running when the queue store is down" do
      logger = instance_double(ActiveSupport::Logger, error: nil)
      scheduler = described_class.new(claim: ->(*) { raise RedisClient::CannotConnectError, "down" }, logger:)

      expect { scheduler.tick }.not_to raise_error
      expect(logger).to have_received(:error).with(/CannotConnectError/)
    end
  end

  describe PurgeExpiredRecordsJob do
    it "removes expired and old records and keeps recent and failed ones" do
      IdempotencyKey.create!(scope: "s", key_digest: "a" * 64, request_digest: "b" * 64, expires_at: 1.minute.ago)
      kept_key = IdempotencyKey.create!(scope: "s", key_digest: "c" * 64, request_digest: "d" * 64, expires_at: 1.day.from_now)
      WebhookEvent.create!(event_id: "old", event_name: "room_started", created_at: 91.days.ago)
      kept_event = WebhookEvent.create!(event_id: "new", event_name: "room_started")
      OutboxMessage.enqueue_room_cleanup!("old").update_columns(completed_at: 31.days.ago)
      failed = OutboxMessage.enqueue_room_cleanup!("failed")
      failed.update_columns(failed_at: 40.days.ago)

      described_class.perform_now

      expect(IdempotencyKey.pluck(:id)).to eq([kept_key.id])
      expect(WebhookEvent.pluck(:id)).to eq([kept_event.id])
      expect(OutboxMessage.pluck(:id)).to eq([failed.id])
    end
  end
end
