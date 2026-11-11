module Api
  module V1
    class CarePlansController < BaseController
      def show
        plan = current_user.active_care_plan
        # Viewing clinical information is recorded, as the guide requires.
        AuditEvent.record!(action: "care_plan.viewed", actor: current_user, subject: plan, ip: request.remote_ip) if plan
        render json: { plan: plan && CarePlanView.new(plan).as_json }
      end

      def dose
        dose = CareDose.joins(:care_plan).merge(current_user.care_plans.where(status: "active")).find(params[:id])
        today = Time.current.in_time_zone(Scheduling::Slots.zone).to_date
        log = DoseLog.find_by(care_dose: dose, taken_on: today)
        if json_body["taken"] == true
          log ||= DoseLog.create_or_find_by!(care_dose: dose, taken_on: today) { |item| item.taken_at = Time.current }
        else
          log&.destroy!
          log = nil
        end
        render json: { id: dose.id, medicine: dose.medicine, instruction: dose.instruction, slot: dose.slot,
                       time: dose.time_of_day, takenAt: Presenters.time(log&.taken_at) }
      end

      def goal
        goal = CareGoal.joins(:care_plan).merge(current_user.care_plans.where(status: "active")).find(params[:id])
        today = Time.current.in_time_zone(Scheduling::Slots.zone).to_date
        if json_body["done"] == true
          GoalLog.create_or_find_by!(care_goal: goal, done_on: today)
        else
          GoalLog.where(care_goal: goal, done_on: today).delete_all
        end
        render json: { id: goal.id, title: goal.title, detail: goal.detail, done: json_body["done"] == true }
      end
    end
  end
end
