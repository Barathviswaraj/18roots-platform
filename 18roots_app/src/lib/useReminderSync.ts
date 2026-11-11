import { useEffect, useMemo } from "react";

import { useCarePlan, useConsultations } from "@/api/queries";
import { useT } from "@/i18n";
import { usePreferences } from "@/store/preferences";
import { clearReminders, syncReminders } from "./reminders";

// Keeps scheduled reminders in step with the care plan and bookings.
export function useReminderSync() {
  const enabled = usePreferences((state) => state.remindersEnabled);
  const language = usePreferences((state) => state.language);
  const t = useT();
  const plan = useCarePlan();
  const upcoming = useConsultations("upcoming");

  const signature = useMemo(
    () =>
      JSON.stringify([
        enabled,
        language,
        plan.data?.doses.map((dose) => [dose.id, dose.time]),
        upcoming.data?.map((item) => [item.id, item.startsAt, item.status]),
      ]),
    [enabled, language, plan.data, upcoming.data],
  );

  useEffect(() => {
    if (!enabled) {
      clearReminders().catch(() => undefined);
      return;
    }
    if (plan.data === undefined && upcoming.data === undefined) return;
    syncReminders({ plan: plan.data, consultations: upcoming.data, t }).catch(() => undefined);
    // The signature captures every input that changes the schedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
