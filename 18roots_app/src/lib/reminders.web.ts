import type { CarePlan, Consultation } from "@/api/schemas";
import type { Translate } from "@/i18n";

// The web preview has no local notifications; these keep the same shape.
export function configureNotifications() {}
export function listenForReminderTaps() {
  return () => undefined;
}
export async function ensureNotificationPermission() {
  return false;
}
export async function clearReminders() {}
export async function syncReminders(_input: {
  plan: CarePlan | null | undefined;
  consultations: Consultation[] | undefined;
  t: Translate;
}) {}
