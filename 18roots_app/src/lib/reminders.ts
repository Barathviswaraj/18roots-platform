import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import type { CarePlan, Consultation } from "@/api/schemas";
import type { Translate } from "@/i18n";

// Local reminders for doses and consultations. Their text never names a
// medicine or condition, so nothing sensitive shows on the lock screen.

const PREFIX = "roots18-";
const CHANNEL = "reminders";

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }).catch(() => undefined);
  }
}

// Opens the screen a reminder points to when the person taps it.
export function listenForReminderTaps() {
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
  };
  open(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function clearReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

export async function syncReminders({
  plan,
  consultations,
  t,
}: {
  plan: CarePlan | null | undefined;
  consultations: Consultation[] | undefined;
  t: Translate;
}) {
  await clearReminders();
  const jobs: Promise<string>[] = [];

  for (const dose of plan?.doses ?? []) {
    const [hour, minute] = dose.time.split(":").map(Number);
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}dose-${dose.id}`,
        content: { title: t("reminder.title"), body: t("reminder.doseBody"), data: { url: "/care" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
      }),
    );
  }

  const now = Date.now();
  for (const consultation of consultations ?? []) {
    const remindAt = new Date(consultation.startsAt).getTime() - 15 * 60_000;
    if (consultation.status !== "confirmed" || remindAt <= now) continue;
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}consult-${consultation.id}`,
        content: {
          title: t("reminder.title"),
          body: t("reminder.consultBody"),
          data: { url: `/consultations/${consultation.id}` },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(remindAt),
          channelId: CHANNEL,
        },
      }),
    );
  }

  await Promise.all(jobs);
}
