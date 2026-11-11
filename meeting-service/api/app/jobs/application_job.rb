class ApplicationJob < ActiveJob::Base
  # Jobs are designed to be safe to retry. Keep room cleanup idempotent.
end

