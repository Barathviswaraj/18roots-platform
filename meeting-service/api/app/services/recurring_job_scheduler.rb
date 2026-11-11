# Enqueues periodic jobs from inside each Sidekiq process, without a separate
# scheduler service. A Valkey key set with NX and an expiry claims each run,
# so with several Sidekiq processes each job still runs once per interval.
class RecurringJobScheduler
  JOBS = [
    { name: "outbox-dispatch", job: "OutboxDispatchJob", every: 1.minute },
    { name: "purge-expired-records", job: "PurgeExpiredRecordsJob", every: 1.hour }
  ].freeze
  TICK_SECONDS = 15

  def initialize(claim: nil, logger: Rails.logger)
    @claim = claim || method(:claim_in_valkey)
    @logger = logger
  end

  def start
    @thread = Thread.new do
      Thread.current.name = "recurring-jobs"
      loop do
        tick
        sleep TICK_SECONDS
      end
    end
    self
  end

  def stop
    @thread&.kill
  end

  def tick
    Rails.application.executor.wrap do
      JOBS.each do |entry|
        next unless @claim.call(entry.fetch(:name), entry.fetch(:every).to_i)

        entry.fetch(:job).constantize.perform_later
      end
    end
  rescue StandardError => error
    @logger.error("[recurring-jobs] #{error.class}: #{error.message}")
  end

  private

  def claim_in_valkey(name, seconds)
    Sidekiq.redis do |connection|
      connection.call("SET", "meeting-service:recurring:#{name}", Time.now.to_i.to_s, "NX", "EX", seconds)
    end == "OK"
  end
end
