import { handleMockRequest, resetMockDb, type MockRequest } from "../src/api/mock/server";
import {
  bookingSchema,
  carePlanResponseSchema,
  consultationSchema,
  homeResponseSchema,
  homeSectionSchema,
  sessionSchema,
} from "../src/api/schemas";

function call(method: string, path: string, options: Partial<MockRequest> = {}) {
  return handleMockRequest({ method, path, query: {}, body: {}, headers: {}, ...options });
}

function signIn() {
  const otp = call("POST", "/v1/auth/otp", { body: { phone: "+919876543210" } });
  const { requestId, demoCode } = otp.body as { requestId: string; demoCode: string };
  const session = call("POST", "/v1/auth/verify", { body: { requestId, phone: "+919876543210", code: demoCode } });
  const parsed = sessionSchema.parse(session.body);
  return { authorization: `Bearer ${parsed.accessToken}` };
}

describe("demo backend", () => {
  beforeEach(() => resetMockDb());

  it("requires a signed-in session for protected routes", () => {
    expect(call("GET", "/v1/home").status).toBe(401);
    expect(call("GET", "/v1/home", { headers: signIn() }).status).toBe(200);
  });

  it("keeps a session across an app restart and ends it on sign-out", () => {
    const headers = signIn();
    resetMockDb();
    expect(call("GET", "/v1/me", { headers }).status).toBe(200);
    expect(call("POST", "/v1/auth/logout", { headers }).status).toBe(204);
    expect(call("GET", "/v1/me", { headers }).status).toBe(401);
  });

  it("rejects a wrong code and an invalid phone number", () => {
    expect(call("POST", "/v1/auth/otp", { body: { phone: "+911234" } }).status).toBe(422);
    const otp = call("POST", "/v1/auth/otp", { body: { phone: "+919876543210" } });
    const { requestId } = otp.body as { requestId: string };
    expect(call("POST", "/v1/auth/verify", { body: { requestId, code: "000000" } }).status).toBe(422);
  });

  it("refreshes tokens once and then refuses the old refresh token", () => {
    const otp = call("POST", "/v1/auth/otp", { body: { phone: "+919876543210" } });
    const { requestId, demoCode } = otp.body as { requestId: string; demoCode: string };
    const session = sessionSchema.parse(call("POST", "/v1/auth/verify", { body: { requestId, code: demoCode } }).body);
    expect(call("POST", "/v1/auth/refresh", { body: { refreshToken: session.refreshToken } }).status).toBe(200);
    expect(call("POST", "/v1/auth/refresh", { body: { refreshToken: session.refreshToken } }).status).toBe(401);
  });

  it("returns home sections that match the app's schemas", () => {
    const home = homeResponseSchema.parse(call("GET", "/v1/home", { headers: signIn() }).body);
    const types = home.sections.map((section) => homeSectionSchema.parse(section).type);
    expect(types).toEqual(["care_journey", "upcoming_consultation", "medicine_reminder", "order_tracking"]);
  });

  it("marks a dose taken and moves the home reminder to the next dose", () => {
    const headers = signIn();
    const before = homeResponseSchema.parse(call("GET", "/v1/home", { headers }).body);
    const reminder = homeSectionSchema.parse(before.sections[2]);
    if (reminder.type !== "medicine_reminder" || !reminder.data.dose) throw new Error("expected a dose");

    expect(
      call("POST", `/v1/care-plan/doses/${reminder.data.dose.id}`, { headers, body: { taken: true } }).status,
    ).toBe(200);

    const after = homeSectionSchema.parse(
      homeResponseSchema.parse(call("GET", "/v1/home", { headers }).body).sections[2],
    );
    if (after.type !== "medicine_reminder") throw new Error("expected the reminder section");
    expect(after.data.dose?.id).not.toBe(reminder.data.dose.id);
    expect(after.data.remaining).toBe(reminder.data.remaining - 1);
    const plan = carePlanResponseSchema.parse(call("GET", "/v1/care-plan", { headers }).body).plan;
    expect(plan?.doses.find((dose) => dose.id === reminder.data.dose?.id)?.takenAt).toBeTruthy();
  });

  it("books once per idempotency key and refuses a taken slot", () => {
    const headers = signIn();
    const day = new Date();
    day.setDate(day.getDate() + 2);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const { slots } = call("GET", "/v1/doctors/doc-meera/slots", { headers, query: { date } }).body as {
      slots: { id: string; available: boolean }[];
    };
    const slot = slots.find((item) => item.available);
    if (!slot) throw new Error("expected a free slot");
    const body = { doctorId: "doc-meera", slotId: slot.id, reason: null, consent: true };

    const first = call("POST", "/v1/bookings", {
      headers: { ...headers, "idempotency-key": "booking-key-000000001" },
      body,
    });
    const retry = call("POST", "/v1/bookings", {
      headers: { ...headers, "idempotency-key": "booking-key-000000001" },
      body,
    });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(bookingSchema.parse(retry.body).id).toBe(bookingSchema.parse(first.body).id);

    const booking = bookingSchema.parse(first.body);
    const confirmed = call("POST", `/v1/bookings/${booking.id}/confirm-payment`, {
      headers,
      body: { paymentId: booking.payment.id },
    });
    expect(bookingSchema.parse(confirmed.body).status).toBe("confirmed");

    const other = call("POST", "/v1/bookings", {
      headers: { ...headers, "idempotency-key": "booking-key-000000002" },
      body,
    });
    expect(other.status).toBe(409);
  });

  it("does not let a consultation starting soon be cancelled in the app", () => {
    const headers = signIn();
    const soon = consultationSchema.parse(call("GET", "/v1/consultations/con-upcoming-1", { headers }).body);
    expect(soon.canCancel).toBe(false);
    expect(call("POST", "/v1/consultations/con-upcoming-1/cancel", { headers }).status).toBe(409);
    expect(call("POST", "/v1/consultations/con-upcoming-2/cancel", { headers }).status).toBe(200);
  });
});
