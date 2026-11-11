import type { Consultation } from "@/api/schemas";

// Without options: "Tue, 10 Nov 2026", the format in the design.
export function formatDate(iso: string, locale: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(iso);
  if (options) return new Intl.DateTimeFormat(locale, options).format(date);
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
}

// "10:45 PM". en-IN writes "pm" in lower case.
export function formatTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\b(am|pm)\b/, (period) => period.toUpperCase());
}

export function formatDayChip(date: Date, locale: string) {
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date),
    day: new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date),
  };
}

export function formatMoney(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

// "+919876543210" -> "+91 98765 43210"
export function formatPhone(phone: string) {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

export function greetingKey(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "home.morning" as const;
  if (hour < 17) return "home.afternoon" as const;
  return "home.evening" as const;
}

export function isJoinOpen(consultation: Pick<Consultation, "status" | "joinOpensAt" | "endsAt">, now = Date.now()) {
  if (!["confirmed", "in_progress"].includes(consultation.status)) return false;
  return now >= new Date(consultation.joinOpensAt).getTime() && now <= new Date(consultation.endsAt).getTime();
}

export function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function newIdempotencyKey(prefix: string) {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
