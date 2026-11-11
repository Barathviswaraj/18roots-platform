import type { AppNotification, CarePlan, Consultation, Doctor, Order, User } from "../schemas";

// Demo data for the built-in backend. Names, registration numbers and medicines
// are illustrative only and are not medical advice.

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type MockBooking = {
  id: string;
  idempotencyKey: string;
  consultationId: string;
  paymentId: string;
  amount: number;
  status: "pending_payment" | "confirmed" | "failed";
};

export type MockDb = {
  user: User;
  doctors: Doctor[];
  consultations: Consultation[];
  bookings: MockBooking[];
  carePlan: CarePlan | null;
  orders: Order[];
  notifications: AppNotification[];
  otpRequests: Map<string, { phone: string; code: string }>;
  // Tokens carry their own expiry (like a JWT), so a session survives an app
  // restart even though this backend's memory does not. Only sign-outs and
  // used refresh tokens need remembering.
  revokedTokens: Set<string>;
  usedRefreshTokens: Set<string>;
};

const POLICY =
  "Free cancellation up to 6 hours before the start. After that, half the fee is refunded. Missed consultations are not refunded.";

function at(base: Date, offsetMs: number) {
  return new Date(base.getTime() + offsetMs).toISOString();
}

function startOfToday(now: Date) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}

function roundUpToFiveMinutes(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 5) * 5);
  return rounded;
}

function dayAt(base: Date, dayOffset: number, hour: number, minute: number) {
  const date = startOfToday(base);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function doctorSummary(doctor: Doctor) {
  return { id: doctor.id, name: doctor.name, title: doctor.title, photoUrl: doctor.photoUrl };
}

export function createDb(now = new Date()): MockDb {
  const doctors: Doctor[] = [
    {
      id: "doc-meera",
      name: "Dr. Meera Krishnan",
      title: "Siddha Physician",
      photoUrl: null,
      verified: true,
      registrationNumber: "TNSIDDHA-04821",
      qualifications: ["BSMS", "MD (Siddha)"],
      experienceYears: 11,
      languages: ["Tamil", "English"],
      specialties: ["PCOD", "Menstrual health", "Women's wellness"],
      fee: { amount: 600, currency: "INR" },
      consultationMinutes: 30,
      rating: 4.9,
      about:
        "Focuses on PCOD and menstrual health through Siddha medicine, diet and daily routine. Consults in Tamil and English.",
      cancellationPolicy: POLICY,
      nextAvailableAt: null,
    },
    {
      id: "doc-kavitha",
      name: "Dr. Kavitha Raman",
      title: "Siddha Gynaecology Consultant",
      photoUrl: null,
      verified: true,
      registrationNumber: "TNSIDDHA-02317",
      qualifications: ["BSMS", "MD (Siddha, Maruthuvam)"],
      experienceYears: 15,
      languages: ["Tamil", "English", "Malayalam"],
      specialties: ["Fertility", "PCOD", "Menopause"],
      fee: { amount: 800, currency: "INR" },
      consultationMinutes: 30,
      rating: 4.8,
      about: "Supports women through fertility planning, PCOD and menopause with classical Siddha care.",
      cancellationPolicy: POLICY,
      nextAvailableAt: null,
    },
    {
      id: "doc-anitha",
      name: "Dr. Anitha Selvam",
      title: "Siddha Physician",
      photoUrl: null,
      verified: true,
      registrationNumber: "TNSIDDHA-06654",
      qualifications: ["BSMS"],
      experienceYears: 7,
      languages: ["Tamil"],
      specialties: ["Thyroid", "Skin care", "Digestion"],
      fee: { amount: 450, currency: "INR" },
      consultationMinutes: 20,
      rating: 4.7,
      about: "Treats thyroid, skin and digestive concerns with gentle Siddha formulations.",
      cancellationPolicy: POLICY,
      nextAvailableAt: null,
    },
    {
      id: "doc-priya",
      name: "Dr. Priya Sundar",
      title: "Siddha Physician, Varmam and Yoga",
      photoUrl: null,
      verified: true,
      registrationNumber: "TNSIDDHA-05109",
      qualifications: ["BSMS", "PG Diploma in Yoga"],
      experienceYears: 9,
      languages: ["Tamil", "English", "Hindi"],
      specialties: ["Stress", "Sleep", "Back pain"],
      fee: { amount: 500, currency: "INR" },
      consultationMinutes: 30,
      rating: 4.8,
      about: "Combines Varmam therapy and yoga to help with stress, sleep and chronic pain.",
      cancellationPolicy: POLICY,
      nextAvailableAt: null,
    },
  ];
  const meera = doctors[0];

  // Starts in about 10 minutes, so Join is already open in the demo.
  const nextStart = roundUpToFiveMinutes(new Date(now.getTime() + 10 * MINUTE));
  const consultations: Consultation[] = [
    {
      id: "con-upcoming-1",
      status: "confirmed",
      startsAt: nextStart.toISOString(),
      endsAt: at(nextStart, 30 * MINUTE),
      joinOpensAt: at(nextStart, -15 * MINUTE),
      mode: "video",
      doctor: doctorSummary(meera),
      reason: "Six-week review of PCOD care plan",
      meetingId: null,
      canCancel: false,
      cancellationPolicy: POLICY,
      followUp: [],
    },
    {
      id: "con-upcoming-2",
      status: "confirmed",
      startsAt: dayAt(now, 6, 17, 30).toISOString(),
      endsAt: dayAt(now, 6, 18, 0).toISOString(),
      joinOpensAt: at(dayAt(now, 6, 17, 30), -15 * MINUTE),
      mode: "video",
      doctor: doctorSummary(doctors[3]),
      reason: "Sleep and stress",
      meetingId: null,
      canCancel: true,
      cancellationPolicy: POLICY,
      followUp: [],
    },
    {
      id: "con-past-1",
      status: "completed",
      startsAt: dayAt(now, -14, 10, 30).toISOString(),
      endsAt: dayAt(now, -14, 11, 0).toISOString(),
      joinOpensAt: at(dayAt(now, -14, 10, 30), -15 * MINUTE),
      mode: "video",
      doctor: doctorSummary(meera),
      reason: "Irregular cycles",
      meetingId: null,
      canCancel: false,
      cancellationPolicy: POLICY,
      followUp: [
        {
          id: "note-1",
          title: "Daily routine",
          body: "Eat breakfast before 9 AM and keep meal times regular. Walk for 30 minutes daily and sleep by 10:30 PM.",
          sharedAt: dayAt(now, -14, 11, 15).toISOString(),
        },
      ],
    },
    {
      id: "con-past-2",
      status: "completed",
      startsAt: dayAt(now, -42, 18, 0).toISOString(),
      endsAt: dayAt(now, -42, 18, 30).toISOString(),
      joinOpensAt: at(dayAt(now, -42, 18, 0), -15 * MINUTE),
      mode: "video",
      doctor: doctorSummary(meera),
      reason: "First consultation",
      meetingId: null,
      canCancel: false,
      cancellationPolicy: POLICY,
      followUp: [],
    },
  ];

  const user: User = {
    id: "user-anika",
    name: "Anika Raghavan",
    phone: "+919876543210",
    email: "anika@example.com",
    dateOfBirth: "14/02/1996",
    city: "Chennai",
    avatarUrl: null,
    programName: "PCOD Care Journey",
  };

  const weekAdherence = Array.from({ length: 7 }, (_, index) => {
    const date = startOfToday(now);
    date.setDate(date.getDate() - (6 - index));
    const total = 3;
    const taken = index === 6 ? 0 : ([3, 2, 3, 3, 1, 3][index] ?? 3);
    return { date: date.toISOString(), taken, total };
  });

  const carePlan: CarePlan = {
    id: "plan-pcod",
    programName: "PCOD Care Journey",
    week: 6,
    totalWeeks: 12,
    progressPercent: 60,
    doctor: doctorSummary(meera),
    nextReviewAt: nextStart.toISOString(),
    milestones: [
      { id: "m1", label: "Herbal care on track", state: "done" },
      { id: "m2", label: "Lifestyle goals in progress", state: "in_progress" },
      { id: "m3", label: "Next consultation upcoming", state: "upcoming" },
    ],
    doses: [
      {
        id: "dose-1",
        medicine: "Karisalankanni Churnam",
        instruction: "1 capsule after breakfast",
        slot: "morning",
        time: "08:30",
        takenAt: null,
      },
      {
        id: "dose-2",
        medicine: "Kumari Lehyam",
        instruction: "1 teaspoon before lunch",
        slot: "afternoon",
        time: "12:30",
        takenAt: null,
      },
      {
        id: "dose-3",
        medicine: "Sathavari Lehyam",
        instruction: "1 teaspoon with warm milk",
        slot: "night",
        time: "21:00",
        takenAt: null,
      },
    ],
    goals: [
      { id: "goal-1", title: "Walk for 30 minutes", detail: "Morning or evening, at an easy pace", done: true },
      { id: "goal-2", title: "Warm water on waking", detail: null, done: true },
      {
        id: "goal-3",
        title: "Baddha Konasana, 10 minutes",
        detail: "Bound angle pose with slow breathing",
        done: false,
      },
      { id: "goal-4", title: "No refined sugar today", detail: null, done: false },
      { id: "goal-5", title: "Sleep by 10:30 PM", detail: null, done: false },
    ],
    weekAdherence,
    notes: consultations[2].followUp,
  };

  const orders: Order[] = [
    {
      id: "ord-180524",
      number: "180524",
      status: "out_for_delivery",
      placedAt: at(now, -2 * DAY),
      expectedAt: dayAt(now, 0, 19, 0).toISOString(),
      deliveredAt: null,
      items: [
        { id: "i1", name: "Karisalankanni Churnam, 100 g", quantity: 1, unitPrice: 240 },
        { id: "i2", name: "Kumari Lehyam, 200 g", quantity: 1, unitPrice: 320 },
        { id: "i3", name: "Sathavari Lehyam, 200 g", quantity: 1, unitPrice: 360 },
      ],
      total: 920,
      currency: "INR",
      address: {
        name: "Anika Raghavan",
        line1: "12, Lotus Street, Anna Nagar",
        line2: null,
        city: "Chennai",
        pincode: "600040",
      },
      paymentMethod: "UPI",
      timeline: [
        { status: "placed", at: at(now, -2 * DAY) },
        { status: "packed", at: at(now, -2 * DAY + 5 * 60 * MINUTE) },
        { status: "shipped", at: at(now, -1 * DAY) },
        { status: "out_for_delivery", at: at(now, -2 * 60 * MINUTE) },
        { status: "delivered", at: null },
      ],
    },
    {
      id: "ord-180311",
      number: "180311",
      status: "delivered",
      placedAt: at(now, -33 * DAY),
      expectedAt: null,
      deliveredAt: at(now, -30 * DAY),
      items: [
        { id: "i4", name: "Karisalankanni Churnam, 100 g", quantity: 2, unitPrice: 240 },
        { id: "i5", name: "Herbal hair oil, 100 ml", quantity: 1, unitPrice: 280 },
      ],
      total: 760,
      currency: "INR",
      address: {
        name: "Anika Raghavan",
        line1: "12, Lotus Street, Anna Nagar",
        line2: null,
        city: "Chennai",
        pincode: "600040",
      },
      paymentMethod: "Card ending 4242",
      timeline: [
        { status: "placed", at: at(now, -33 * DAY) },
        { status: "packed", at: at(now, -33 * DAY + 4 * 60 * MINUTE) },
        { status: "shipped", at: at(now, -32 * DAY) },
        { status: "out_for_delivery", at: at(now, -30 * DAY - 5 * 60 * MINUTE) },
        { status: "delivered", at: at(now, -30 * DAY) },
      ],
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: "n1",
      title: "Consultation today",
      body: "Your consultation with Dr. Meera Krishnan starts soon.",
      createdAt: at(now, -20 * MINUTE),
      read: false,
      link: "/consultations/con-upcoming-1",
    },
    {
      id: "n2",
      title: "Order out for delivery",
      body: "Order #180524 will arrive today.",
      createdAt: at(now, -2 * 60 * MINUTE),
      read: false,
      link: "/orders/ord-180524",
    },
    {
      id: "n3",
      title: "Your doctor shared a note",
      body: "Dr. Meera Krishnan added guidance to your care plan.",
      createdAt: at(now, -14 * DAY),
      read: true,
      link: "/care",
    },
  ];

  return {
    user,
    doctors,
    consultations,
    bookings: [],
    carePlan,
    orders,
    notifications,
    otpRequests: new Map(),
    revokedTokens: new Set(),
    usedRefreshTokens: new Set(),
  };
}
