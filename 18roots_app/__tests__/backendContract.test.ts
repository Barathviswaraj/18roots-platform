/// <reference types="node" />
import fs from "fs";
import path from "path";
import { z } from "zod";

import {
  bookingSchema,
  carePlanResponseSchema,
  consultationSchema,
  doctorSchema,
  doseSchema,
  goalSchema,
  homeResponseSchema,
  homeSectionSchema,
  notificationSchema,
  orderSchema,
  otpRequestSchema,
  sessionSchema,
  slotSchema,
  tokensSchema,
  userSchema,
} from "../src/api/schemas";

// Real responses saved by the main backend's specs (main-backend/spec/contract).
// If the backend and the app drift apart, this test fails before the app does.
const FIXTURES = path.resolve(__dirname, "../../main-backend/spec/contract/fixtures");

const SCHEMAS: Record<string, z.ZodType> = {
  otp: otpRequestSchema,
  session: sessionSchema,
  tokens: tokensSchema,
  me: userSchema,
  home: homeResponseSchema.extend({ sections: z.array(homeSectionSchema) }),
  care_plan: carePlanResponseSchema,
  dose: doseSchema,
  goal: goalSchema,
  doctors: z.object({ doctors: z.array(doctorSchema) }),
  doctor: doctorSchema,
  slots: z.object({ slots: z.array(slotSchema) }),
  booking_pending: bookingSchema,
  booking_confirmed: bookingSchema,
  consultations: z.object({ consultations: z.array(consultationSchema) }),
  orders: z.object({ orders: z.array(orderSchema) }),
  notifications: z.object({ notifications: z.array(notificationSchema) }),
};

const available = fs.existsSync(FIXTURES);
const describeIfBackend = available ? describe : describe.skip;

describeIfBackend("main backend contract", () => {
  it("has a fixture for every response the app reads", () => {
    const files = fs.readdirSync(FIXTURES).map((file: string) => file.replace(/\.json$/, ""));
    expect(files.sort()).toEqual(Object.keys(SCHEMAS).sort());
  });

  it.each(Object.keys(SCHEMAS))("%s matches the app's schema", (name) => {
    const body = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));
    const result = SCHEMAS[name].safeParse(body);
    if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
  });
});
