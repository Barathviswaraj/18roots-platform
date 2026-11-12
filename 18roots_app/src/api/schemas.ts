import { z } from "zod";

// The contract with the main backend. Every response is checked against these
// schemas, so a backend change shows up as a clear error instead of a crash.

const isoDate = z.string().min(10);

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  city: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  programName: z.string().nullable(),
  // Older deployments do not include role yet; treat those accounts as patients
  // until the backend migration is deployed.
  role: z.enum(["patient", "doctor", "admin"]).default("patient"),
});

export const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: isoDate,
  user: userSchema,
});

export const tokensSchema = sessionSchema.pick({ accessToken: true, refreshToken: true, expiresAt: true });

export const otpRequestSchema = z.object({
  requestId: z.string(),
  resendAfterSeconds: z.number(),
  demoCode: z.string().nullable().optional(),
});

export const moneySchema = z.object({ amount: z.number(), currency: z.literal("INR") });

export const doctorSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  photoUrl: z.string().nullable(),
});

export const doctorSchema = doctorSummarySchema.extend({
  verified: z.boolean(),
  registrationNumber: z.string(),
  qualifications: z.array(z.string()),
  experienceYears: z.number(),
  languages: z.array(z.string()),
  specialties: z.array(z.string()),
  fee: moneySchema,
  consultationMinutes: z.number(),
  rating: z.number().nullable(),
  about: z.string(),
  cancellationPolicy: z.string(),
  nextAvailableAt: isoDate.nullable(),
});

export const slotSchema = z.object({
  id: z.string(),
  startsAt: isoDate,
  endsAt: isoDate,
  available: z.boolean(),
});

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  sharedAt: isoDate,
});

export const consultationStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "missed",
]);

export const consultationSchema = z.object({
  id: z.string(),
  status: consultationStatusSchema,
  startsAt: isoDate,
  endsAt: isoDate,
  joinOpensAt: isoDate,
  mode: z.literal("video"),
  doctor: doctorSummarySchema,
  reason: z.string().nullable(),
  meetingId: z.string().nullable(),
  canCancel: z.boolean(),
  cancellationPolicy: z.string(),
  followUp: z.array(noteSchema),
});

export const paymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.literal("INR"),
  status: z.enum(["requires_payment", "processing", "paid", "failed"]),
  provider: z.enum(["demo", "payment_service"]),
  checkoutUrl: z.string().nullable(),
});

export const bookingSchema = z.object({
  id: z.string(),
  status: z.enum(["pending_payment", "confirmed", "failed"]),
  consultation: consultationSchema,
  payment: paymentSchema,
});

export const milestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  state: z.enum(["done", "in_progress", "upcoming"]),
});

export const doseSlotSchema = z.enum(["morning", "afternoon", "night"]);

export const doseSchema = z.object({
  id: z.string(),
  medicine: z.string(),
  instruction: z.string(),
  slot: doseSlotSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  takenAt: isoDate.nullable(),
});

export const goalSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  done: z.boolean(),
});

export const carePlanSchema = z.object({
  id: z.string(),
  programName: z.string(),
  week: z.number(),
  totalWeeks: z.number(),
  progressPercent: z.number().min(0).max(100),
  doctor: doctorSummarySchema,
  nextReviewAt: isoDate.nullable(),
  milestones: z.array(milestoneSchema),
  doses: z.array(doseSchema),
  goals: z.array(goalSchema),
  weekAdherence: z.array(z.object({ date: isoDate, taken: z.number(), total: z.number() })),
  notes: z.array(noteSchema),
});

export const carePlanResponseSchema = z.object({ plan: carePlanSchema.nullable() });

export const orderStatusSchema = z.enum(["placed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"]);

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  placedAt: isoDate,
  expectedAt: isoDate.nullable(),
  deliveredAt: isoDate.nullable(),
  items: z.array(z.object({ id: z.string(), name: z.string(), quantity: z.number(), unitPrice: z.number() })),
  total: z.number(),
  currency: z.literal("INR"),
  address: z.object({
    name: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    pincode: z.string(),
  }),
  paymentMethod: z.string(),
  timeline: z.array(z.object({ status: orderStatusSchema, at: isoDate.nullable() })),
});

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: isoDate,
  read: z.boolean(),
  link: z.string().nullable(),
});

// Home is rendered from a list of sections the backend chooses, so the server
// can reorder, add or hide cards without an app release. Unknown section types
// are skipped, which keeps older app versions working.
export const homeSectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("care_journey"),
    id: z.string(),
    data: carePlanSchema.pick({
      programName: true,
      week: true,
      totalWeeks: true,
      progressPercent: true,
      milestones: true,
    }),
  }),
  z.object({
    type: z.literal("upcoming_consultation"),
    id: z.string(),
    data: z.object({ consultation: consultationSchema.nullable() }),
  }),
  z.object({
    type: z.literal("medicine_reminder"),
    id: z.string(),
    data: z.object({ dose: doseSchema.nullable(), remaining: z.number() }),
  }),
  z.object({
    type: z.literal("order_tracking"),
    id: z.string(),
    data: z.object({ order: orderSchema }),
  }),
]);

export const homeResponseSchema = z.object({
  user: z.object({ name: z.string(), avatarUrl: z.string().nullable() }),
  message: z.string(),
  unreadNotifications: z.number(),
  sections: z.array(z.unknown()),
});

export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Tokens = z.infer<typeof tokensSchema>;
export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type DoctorSummary = z.infer<typeof doctorSummarySchema>;
export type Doctor = z.infer<typeof doctorSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type Note = z.infer<typeof noteSchema>;
export type ConsultationStatus = z.infer<typeof consultationStatusSchema>;
export type Consultation = z.infer<typeof consultationSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type DoseSlot = z.infer<typeof doseSlotSchema>;
export type Dose = z.infer<typeof doseSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CarePlan = z.infer<typeof carePlanSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type Order = z.infer<typeof orderSchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type HomeSection = z.infer<typeof homeSectionSchema>;
export type HomeResponse = Omit<z.infer<typeof homeResponseSchema>, "sections"> & { sections: HomeSection[] };
