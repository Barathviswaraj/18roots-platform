import { z } from "zod";

import { api, parse } from "./client";
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
  userSchema,
  type HomeResponse,
  type HomeSection,
} from "./schemas";

export const authApi = {
  requestOtp: async (phone: string) => parse(otpRequestSchema, (await api.post("/v1/auth/otp", { phone })).data),
  verifyOtp: async (input: { requestId: string; phone: string; code: string }) =>
    parse(sessionSchema, (await api.post("/v1/auth/verify", input)).data),
  logout: async () => {
    await api.post("/v1/auth/logout", null, { skipAuthRefresh: true });
  },
};

export const profileApi = {
  get: async () => parse(userSchema, (await api.get("/v1/me")).data),
  update: async (input: { name: string; email: string | null; dateOfBirth: string | null; city: string }) =>
    parse(userSchema, (await api.patch("/v1/me", input)).data),
};

export const homeApi = {
  get: async (): Promise<HomeResponse> => {
    const raw = parse(homeResponseSchema, (await api.get("/v1/home")).data);
    const sections: HomeSection[] = [];
    for (const section of raw.sections) {
      const result = homeSectionSchema.safeParse(section);
      if (result.success) sections.push(result.data);
      else if (__DEV__) console.warn("Skipping a home section this app version does not know", section);
    }
    return { ...raw, sections };
  },
};

export const careApi = {
  get: async () => parse(carePlanResponseSchema, (await api.get("/v1/care-plan")).data).plan,
  setDoseTaken: async (doseId: string, taken: boolean) =>
    parse(doseSchema, (await api.post(`/v1/care-plan/doses/${doseId}`, { taken })).data),
  setGoalDone: async (goalId: string, done: boolean) =>
    parse(goalSchema, (await api.put(`/v1/care-plan/goals/${goalId}`, { done })).data),
};

export const doctorsApi = {
  list: async (filters: { query?: string; language?: string }) =>
    parse(z.object({ doctors: z.array(doctorSchema) }), (await api.get("/v1/doctors", { params: filters })).data)
      .doctors,
  get: async (doctorId: string) => parse(doctorSchema, (await api.get(`/v1/doctors/${doctorId}`)).data),
  slots: async (doctorId: string, date: string) =>
    parse(
      z.object({ slots: z.array(slotSchema) }),
      (await api.get(`/v1/doctors/${doctorId}/slots`, { params: { date } })).data,
    ).slots,
};

export const consultationsApi = {
  list: async (scope: "upcoming" | "past") =>
    parse(
      z.object({ consultations: z.array(consultationSchema) }),
      (await api.get("/v1/consultations", { params: { scope } })).data,
    ).consultations,
  get: async (consultationId: string) =>
    parse(consultationSchema, (await api.get(`/v1/consultations/${consultationId}`)).data),
  cancel: async (consultationId: string) =>
    parse(consultationSchema, (await api.post(`/v1/consultations/${consultationId}/cancel`)).data),
};

export const bookingsApi = {
  // consent: the patient accepted the consultation terms and cancellation policy.
  create: async (
    input: { doctorId: string; slotId: string; reason: string | null; consent: true },
    idempotencyKey: string,
  ) =>
    parse(
      bookingSchema,
      (await api.post("/v1/bookings", input, { headers: { "Idempotency-Key": idempotencyKey } })).data,
    ),
  get: async (bookingId: string) => parse(bookingSchema, (await api.get(`/v1/bookings/${bookingId}`)).data),
  confirmPayment: async (bookingId: string, paymentId: string) =>
    parse(bookingSchema, (await api.post(`/v1/bookings/${bookingId}/confirm-payment`, { paymentId })).data),
};

export const ordersApi = {
  list: async (status: "all" | "active" | "delivered") =>
    parse(z.object({ orders: z.array(orderSchema) }), (await api.get("/v1/orders", { params: { status } })).data)
      .orders,
  get: async (orderId: string) => parse(orderSchema, (await api.get(`/v1/orders/${orderId}`)).data),
};

export const notificationsApi = {
  list: async () =>
    parse(z.object({ notifications: z.array(notificationSchema) }), (await api.get("/v1/notifications")).data)
      .notifications,
  markRead: async (notificationId: string) => {
    await api.post(`/v1/notifications/${notificationId}/read`);
  },
  markAllRead: async () => {
    await api.post("/v1/notifications/read-all");
  },
};
