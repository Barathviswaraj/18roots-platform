import { z } from "zod";

import type { Translate } from "@/i18n";

// Form rules, built per language so error messages are translated.

export const phoneFormSchema = (t: Translate) =>
  z.object({
    phone: z
      .string()
      .transform((value) => value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
      .pipe(z.string().regex(/^[6-9]\d{9}$/, t("auth.invalidPhone"))),
  });

export const otpFormSchema = (t: Translate) =>
  z.object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, t("auth.invalidCode")),
  });

function isPastDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid && year >= 1900 && date.getTime() < Date.now();
}

export const profileFormSchema = (t: Translate) =>
  z.object({
    name: z.string().trim().min(2, t("profile.nameInvalid")).max(60, t("profile.nameInvalid")),
    email: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), t("profile.emailInvalid")),
    dateOfBirth: z
      .string()
      .trim()
      .refine((value) => value === "" || isPastDate(value), t("profile.dobInvalid")),
    city: z.string().trim().min(2, t("profile.cityInvalid")).max(60, t("profile.cityInvalid")),
  });

export const bookingFormSchema = (t: Translate) =>
  z.object({
    reason: z.string().max(500, t("booking.reasonTooLong")),
    consent: z.boolean().refine((value) => value, t("booking.consentRequired")),
  });

export type PhoneForm = z.input<ReturnType<typeof phoneFormSchema>>;
export type OtpForm = z.infer<ReturnType<typeof otpFormSchema>>;
export type ProfileForm = z.infer<ReturnType<typeof profileFormSchema>>;
export type BookingForm = z.infer<ReturnType<typeof bookingFormSchema>>;
