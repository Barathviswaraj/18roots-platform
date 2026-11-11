import { homeSectionSchema } from "../src/api/schemas";
import { en, type TranslationKey } from "../src/i18n/en";
import { ta } from "../src/i18n/ta";
import { translate } from "../src/i18n/translate";
import { formatPhone, greetingKey, initials, isJoinOpen } from "../src/lib/format";
import { bookingFormSchema, phoneFormSchema, profileFormSchema } from "../src/lib/validation";

const t = (key: TranslationKey, params?: Record<string, string | number>) => translate("en", key, params);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("translations", () => {
  it("has every Tamil string filled with the same placeholders as English", () => {
    for (const key of Object.keys(en) as TranslationKey[]) {
      expect(ta[key].trim()).not.toBe("");
      expect(placeholders(ta[key])).toEqual(placeholders(en[key]));
    }
  });

  it("fills placeholders", () => {
    expect(translate("en", "home.weekOf", { week: 6, total: 12 })).toBe("Week 6 of 12");
    expect(translate("ta", "home.weekOf", { week: 6, total: 12 })).toContain("6");
  });
});

describe("form rules", () => {
  it("accepts Indian mobile numbers in common formats", () => {
    const schema = phoneFormSchema(t);
    expect(schema.parse({ phone: "98765 43210" }).phone).toBe("9876543210");
    expect(schema.parse({ phone: "+91 98765-43210" }).phone).toBe("9876543210");
    expect(schema.safeParse({ phone: "12345 67890" }).success).toBe(false);
    expect(schema.safeParse({ phone: "98765" }).success).toBe(false);
  });

  it("checks profile fields", () => {
    const schema = profileFormSchema(t);
    const valid = { name: "Anika", email: "", dateOfBirth: "14/02/1996", city: "Chennai" };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, dateOfBirth: "31/02/1996" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, dateOfBirth: "01/01/2999" }).success).toBe(false);
  });

  it("needs consent before payment", () => {
    const schema = bookingFormSchema(t);
    expect(schema.safeParse({ reason: "", consent: false }).success).toBe(false);
    expect(schema.safeParse({ reason: "", consent: true }).success).toBe(true);
  });
});

describe("formatting and timing", () => {
  it("opens Join 15 minutes before and closes it at the end", () => {
    const start = Date.parse("2026-11-10T10:30:00Z");
    const consultation = {
      status: "confirmed" as const,
      joinOpensAt: new Date(start - 15 * 60_000).toISOString(),
      endsAt: new Date(start + 30 * 60_000).toISOString(),
    };
    expect(isJoinOpen(consultation, start - 16 * 60_000)).toBe(false);
    expect(isJoinOpen(consultation, start - 10 * 60_000)).toBe(true);
    expect(isJoinOpen(consultation, start + 31 * 60_000)).toBe(false);
    expect(isJoinOpen({ ...consultation, status: "cancelled" }, start)).toBe(false);
  });

  it("formats names, numbers and greetings", () => {
    expect(initials("Dr. Meera Krishnan")).toBe("MK");
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(greetingKey(new Date(2026, 0, 1, 8))).toBe("home.morning");
    expect(greetingKey(new Date(2026, 0, 1, 14))).toBe("home.afternoon");
    expect(greetingKey(new Date(2026, 0, 1, 20))).toBe("home.evening");
  });
});

describe("home sections", () => {
  it("rejects section types this app version does not know", () => {
    expect(homeSectionSchema.safeParse({ type: "weather", id: "w", data: {} }).success).toBe(false);
  });
});
