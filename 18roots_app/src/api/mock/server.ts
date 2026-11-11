import type { Booking, Consultation, Doctor, Dose, HomeResponse, Slot } from "../schemas";
import { createDb, doctorSummary, type MockDb } from "./db";

// An in-memory stand-in for the main backend, used when EXPO_PUBLIC_API_MODE
// is "mock". It follows the same contract as src/api/schemas.ts.

export type MockRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};
export type MockResponse = { status: number; body?: unknown };

const DEMO_OTP = "123456";
const ACCESS_TOKEN_TTL_MS = 60 * 60_000;
const JOIN_WINDOW_MS = 15 * 60_000;

let db: MockDb = createDb();
let counter = 0;

export function resetMockDb(now = new Date()) {
  db = createDb(now);
}

function id(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter}`;
}

const ok = (body: unknown, status = 200): MockResponse => ({ status, body });
const fail = (status: number, code: string, message: string): MockResponse => ({
  status,
  body: { error: { code, message } },
});

function session() {
  const expiresAt = Date.now() + ACCESS_TOKEN_TTL_MS;
  const accessToken = id(`mock-access-${expiresAt}`);
  const refreshToken = id("mock-refresh");
  return { accessToken, refreshToken, expiresAt: new Date(expiresAt).toISOString() };
}

function bearer(req: MockRequest) {
  return (req.headers.authorization ?? req.headers.Authorization ?? "").replace(/^Bearer /, "");
}

function authorized(req: MockRequest) {
  const token = bearer(req);
  const expiresAt = Number(/^mock-access-(\d+)-/.exec(token)?.[1] ?? 0);
  return expiresAt > Date.now() && !db.revokedTokens.has(token);
}

function dateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Deterministic "busy" slots, so the same doctor shows the same gaps.
function looksBusy(doctorId: string, start: Date) {
  const seed = `${doctorId}${start.getDate()}${start.getHours()}${start.getMinutes()}`;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  return hash % 4 === 0;
}

function slotsFor(doctor: Doctor, day: string, now = new Date()): Slot[] {
  const [year, month, date] = day.split("-").map(Number);
  const slots: Slot[] = [];
  for (const [fromHour, toHour] of [
    [10, 13],
    [16, 19],
  ]) {
    for (let minutes = fromHour * 60; minutes < toHour * 60; minutes += 30) {
      const start = new Date(year, month - 1, date, Math.floor(minutes / 60), minutes % 60);
      if (start.getTime() < now.getTime() + 30 * 60_000) continue;
      const end = new Date(start.getTime() + doctor.consultationMinutes * 60_000);
      const taken = db.consultations.some(
        (item) => item.doctor.id === doctor.id && item.status !== "cancelled" && item.startsAt === start.toISOString(),
      );
      slots.push({
        id: `${doctor.id}_${start.toISOString()}`,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        available: !taken && !looksBusy(doctor.id, start),
      });
    }
  }
  return slots;
}

function withNextAvailable(doctor: Doctor): Doctor {
  const now = new Date();
  for (let offset = 0; offset < 14; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const slot = slotsFor(doctor, dateKey(day), now).find((item) => item.available);
    if (slot) return { ...doctor, nextAvailableAt: slot.startsAt };
  }
  return { ...doctor, nextAvailableAt: null };
}

function refreshConsultation(item: Consultation): Consultation {
  const now = Date.now();
  const start = new Date(item.startsAt).getTime();
  const end = new Date(item.endsAt).getTime();
  let status = item.status;
  if (status === "confirmed" && now > end) status = "missed";
  const canCancel = status === "confirmed" && start - now > 6 * 60 * 60_000;
  return { ...item, status, canCancel };
}

function nextDose(): { dose: Dose | null; remaining: number } {
  const plan = db.carePlan;
  if (!plan) return { dose: null, remaining: 0 };
  const pending = plan.doses.filter((dose) => !dose.takenAt);
  return { dose: pending[0] ?? null, remaining: pending.length };
}

function upcoming() {
  return db.consultations
    .map(refreshConsultation)
    .filter((item) => ["confirmed", "in_progress", "pending_payment"].includes(item.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function bookingResponse(booking: (typeof db.bookings)[number]): Booking {
  const consultation = db.consultations.find((item) => item.id === booking.consultationId)!;
  return {
    id: booking.id,
    status: booking.status,
    consultation: refreshConsultation(consultation),
    payment: {
      id: booking.paymentId,
      amount: booking.amount,
      currency: "INR",
      status: booking.status === "confirmed" ? "paid" : booking.status === "failed" ? "failed" : "requires_payment",
      provider: "demo",
      checkoutUrl: null,
    },
  };
}

type Handler = (req: MockRequest, params: Record<string, string>) => MockResponse;
type Route = { method: string; pattern: RegExp; keys: string[]; open?: boolean; handler: Handler };

const routes: Route[] = [];
function route(method: string, path: string, handler: Handler, open = false) {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return "([^/]+)";
    })}$`,
  );
  routes.push({ method, pattern, keys, handler, open });
}

// --- Auth -------------------------------------------------------------------

route(
  "POST",
  "/v1/auth/otp",
  (req) => {
    const phone = String(req.body.phone ?? "");
    if (!/^\+91[6-9]\d{9}$/.test(phone)) return fail(422, "invalid_phone", "Enter a valid mobile number");
    const requestId = id("otp");
    db.otpRequests.set(requestId, { phone, code: DEMO_OTP });
    return ok({ requestId, resendAfterSeconds: 30, demoCode: DEMO_OTP });
  },
  true,
);

route(
  "POST",
  "/v1/auth/verify",
  (req) => {
    const request = db.otpRequests.get(String(req.body.requestId ?? ""));
    if (!request || request.code !== String(req.body.code ?? "")) {
      return fail(422, "invalid_code", "That code is not right");
    }
    db.otpRequests.delete(String(req.body.requestId));
    db.user = { ...db.user, phone: request.phone };
    return ok({ ...session(), user: db.user });
  },
  true,
);

route(
  "POST",
  "/v1/auth/refresh",
  (req) => {
    const refreshToken = String(req.body.refreshToken ?? "");
    // Each refresh token works once; the response carries a new pair.
    if (!refreshToken.startsWith("mock-refresh-") || db.usedRefreshTokens.has(refreshToken)) {
      return fail(401, "invalid_refresh_token", "Please sign in again");
    }
    db.usedRefreshTokens.add(refreshToken);
    return ok(session());
  },
  true,
);

route("POST", "/v1/auth/logout", (req) => {
  db.revokedTokens.add(bearer(req));
  return { status: 204 };
});

// --- Profile ----------------------------------------------------------------

route("GET", "/v1/me", () => ok(db.user));
route("PATCH", "/v1/me", (req) => {
  const { name, email, dateOfBirth, city } = req.body as Record<string, string | null>;
  db.user = {
    ...db.user,
    name: name ?? db.user.name,
    email: email === undefined ? db.user.email : email || null,
    dateOfBirth: dateOfBirth === undefined ? db.user.dateOfBirth : dateOfBirth || null,
    city: city === undefined ? db.user.city : city || null,
  };
  return ok(db.user);
});

// --- Home (server-driven sections) ------------------------------------------

route("GET", "/v1/home", () => {
  const sections: HomeResponse["sections"] = [];
  const plan = db.carePlan;
  if (plan) {
    sections.push({
      type: "care_journey",
      id: "care-journey",
      data: {
        programName: plan.programName,
        week: plan.week,
        totalWeeks: plan.totalWeeks,
        progressPercent: plan.progressPercent,
        milestones: plan.milestones,
      },
    });
  }
  sections.push({
    type: "upcoming_consultation",
    id: "next-consultation",
    data: { consultation: upcoming()[0] ?? null },
  });
  if (plan) sections.push({ type: "medicine_reminder", id: "medicine", data: nextDose() });
  const activeOrder = db.orders.find((order) => !["delivered", "cancelled"].includes(order.status));
  if (activeOrder) sections.push({ type: "order_tracking", id: "order", data: { order: activeOrder } });

  return ok({
    user: { name: db.user.name.split(" ")[0], avatarUrl: db.user.avatarUrl },
    message: "A more balanced you is a journey, and you're doing so well",
    unreadNotifications: db.notifications.filter((item) => !item.read).length,
    sections,
  });
});

// --- Care plan --------------------------------------------------------------

route("GET", "/v1/care-plan", () => ok({ plan: db.carePlan }));

route("POST", "/v1/care-plan/doses/:id", (req, { id: doseId }) => {
  const plan = db.carePlan;
  const dose = plan?.doses.find((item) => item.id === doseId);
  if (!plan || !dose) return fail(404, "not_found", "Dose not found");
  dose.takenAt = req.body.taken ? new Date().toISOString() : null;
  const today = plan.weekAdherence[plan.weekAdherence.length - 1];
  if (today) today.taken = plan.doses.filter((item) => item.takenAt).length;
  return ok(dose);
});

route("PUT", "/v1/care-plan/goals/:id", (req, { id: goalId }) => {
  const goal = db.carePlan?.goals.find((item) => item.id === goalId);
  if (!goal) return fail(404, "not_found", "Goal not found");
  goal.done = Boolean(req.body.done);
  return ok(goal);
});

// --- Doctors and slots ------------------------------------------------------

route("GET", "/v1/doctors", (req) => {
  const query = (req.query.query ?? "").trim().toLowerCase();
  const language = req.query.language ?? "";
  const doctors = db.doctors
    .filter(
      (doctor) =>
        !query ||
        doctor.name.toLowerCase().includes(query) ||
        doctor.specialties.some((item) => item.toLowerCase().includes(query)),
    )
    .filter((doctor) => !language || doctor.languages.includes(language))
    .map(withNextAvailable);
  return ok({ doctors });
});

route("GET", "/v1/doctors/:id", (_req, { id: doctorId }) => {
  const doctor = db.doctors.find((item) => item.id === doctorId);
  return doctor ? ok(withNextAvailable(doctor)) : fail(404, "not_found", "Doctor not found");
});

route("GET", "/v1/doctors/:id/slots", (req, { id: doctorId }) => {
  const doctor = db.doctors.find((item) => item.id === doctorId);
  if (!doctor) return fail(404, "not_found", "Doctor not found");
  const day = req.query.date;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail(400, "invalid_date", "Use YYYY-MM-DD");
  return ok({ slots: slotsFor(doctor, day) });
});

// --- Consultations ----------------------------------------------------------

route("GET", "/v1/consultations", (req) => {
  const scope = req.query.scope === "past" ? "past" : "upcoming";
  const items =
    scope === "upcoming"
      ? upcoming()
      : db.consultations
          .map(refreshConsultation)
          .filter((item) => ["completed", "cancelled", "missed"].includes(item.status))
          .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return ok({ consultations: items });
});

route("GET", "/v1/consultations/:id", (_req, { id: consultationId }) => {
  const item = db.consultations.find((entry) => entry.id === consultationId);
  return item ? ok(refreshConsultation(item)) : fail(404, "not_found", "Consultation not found");
});

route("POST", "/v1/consultations/:id/cancel", (_req, { id: consultationId }) => {
  const item = db.consultations.find((entry) => entry.id === consultationId);
  if (!item) return fail(404, "not_found", "Consultation not found");
  if (!refreshConsultation(item).canCancel) {
    return fail(409, "cannot_cancel", "This consultation can no longer be cancelled in the app");
  }
  item.status = "cancelled";
  return ok(refreshConsultation(item));
});

// --- Booking and payment ----------------------------------------------------

route("POST", "/v1/bookings", (req) => {
  const key = req.headers["idempotency-key"] ?? req.headers["Idempotency-Key"];
  if (!key || key.length < 16) return fail(400, "idempotency_key_required", "Missing Idempotency-Key");
  // The same key returns the same booking, so a double tap or a retried
  // request never creates a second booking or payment.
  const existing = db.bookings.find((item) => item.idempotencyKey === key);
  if (existing) return ok(bookingResponse(existing));

  if (req.body.consent !== true) return fail(422, "consent_required", "Please accept the consultation terms");
  const doctor = db.doctors.find((item) => item.id === req.body.doctorId);
  if (!doctor) return fail(404, "not_found", "Doctor not found");
  const slotId = String(req.body.slotId ?? "");
  const startsAt = slotId.split("_")[1] ?? "";
  const slot = slotsFor(doctor, dateKey(new Date(startsAt))).find((item) => item.id === slotId);
  if (!slot || !slot.available) return fail(409, "slot_unavailable", "That time is no longer available");

  const consultation: Consultation = {
    id: id("con"),
    status: "pending_payment",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    joinOpensAt: new Date(new Date(slot.startsAt).getTime() - JOIN_WINDOW_MS).toISOString(),
    mode: "video",
    doctor: doctorSummary(doctor),
    reason: typeof req.body.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : null,
    meetingId: null,
    canCancel: false,
    cancellationPolicy: doctor.cancellationPolicy,
    followUp: [],
  };
  db.consultations.push(consultation);
  const booking = {
    id: id("bkg"),
    idempotencyKey: key,
    consultationId: consultation.id,
    paymentId: id("pay"),
    amount: doctor.fee.amount,
    status: "pending_payment" as const,
  };
  db.bookings.push(booking);
  return ok(bookingResponse(booking), 201);
});

route("GET", "/v1/bookings/:id", (_req, { id: bookingId }) => {
  const booking = db.bookings.find((item) => item.id === bookingId);
  return booking ? ok(bookingResponse(booking)) : fail(404, "not_found", "Booking not found");
});

route("POST", "/v1/bookings/:id/confirm-payment", (req, { id: bookingId }) => {
  const booking = db.bookings.find((item) => item.id === bookingId);
  if (!booking) return fail(404, "not_found", "Booking not found");
  if (req.body.paymentId !== booking.paymentId) return fail(422, "payment_mismatch", "Payment does not match");
  if (booking.status === "pending_payment") {
    booking.status = "confirmed";
    const consultation = db.consultations.find((item) => item.id === booking.consultationId);
    if (consultation) consultation.status = "confirmed";
  }
  return ok(bookingResponse(booking));
});

// --- Orders -----------------------------------------------------------------

route("GET", "/v1/orders", (req) => {
  const status = req.query.status ?? "all";
  const orders = db.orders
    .filter((order) => {
      if (status === "active") return !["delivered", "cancelled"].includes(order.status);
      if (status === "delivered") return order.status === "delivered";
      return true;
    })
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  return ok({ orders });
});

route("GET", "/v1/orders/:id", (_req, { id: orderId }) => {
  const order = db.orders.find((item) => item.id === orderId);
  return order ? ok(order) : fail(404, "not_found", "Order not found");
});

// --- Notifications ----------------------------------------------------------

route("GET", "/v1/notifications", () =>
  ok({ notifications: [...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }),
);

route("POST", "/v1/notifications/read-all", () => {
  db.notifications.forEach((item) => {
    item.read = true;
  });
  return { status: 204 };
});

route("POST", "/v1/notifications/:id/read", (_req, { id: notificationId }) => {
  const item = db.notifications.find((entry) => entry.id === notificationId);
  if (!item) return fail(404, "not_found", "Notification not found");
  item.read = true;
  return ok(item);
});

export function handleMockRequest(req: MockRequest): MockResponse {
  for (const entry of routes) {
    if (entry.method !== req.method) continue;
    const match = entry.pattern.exec(req.path);
    if (!match) continue;
    if (!entry.open && !authorized(req)) return fail(401, "unauthorized", "Please sign in");
    const params = Object.fromEntries(entry.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    return entry.handler(req, params);
  }
  return fail(404, "not_found", `No mock route for ${req.method} ${req.path}`);
}
