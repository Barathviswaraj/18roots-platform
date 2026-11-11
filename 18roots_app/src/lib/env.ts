import { z } from "zod";

// EXPO_PUBLIC_* values are copied into the app when it is bundled, so they
// must be read as literal process.env.EXPO_PUBLIC_... expressions. Never put
// secrets in them: anyone with the app can read them.
const schema = z
  .object({
    apiMode: z.enum(["mock", "live"]),
    apiUrl: z
      .string()
      .regex(/^https?:\/\//)
      .optional(),
    meetingApiUrl: z
      .string()
      .regex(/^https?:\/\//)
      .optional(),
    supportPhone: z.string().min(6),
    mockFailureRate: z.number().min(0).max(1),
    showMeetingId: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.apiMode === "live" && !value.apiUrl) {
      context.addIssue({ code: "custom", path: ["apiUrl"], message: "EXPO_PUBLIC_API_URL is required in live mode" });
    }
    if (value.apiMode === "live" && !value.meetingApiUrl) {
      context.addIssue({
        code: "custom",
        path: ["meetingApiUrl"],
        message: "EXPO_PUBLIC_MEETING_API_URL is required in live mode",
      });
    }
  });

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse({
  apiMode: process.env.EXPO_PUBLIC_API_MODE || "mock",
  apiUrl: process.env.EXPO_PUBLIC_API_URL || undefined,
  meetingApiUrl: process.env.EXPO_PUBLIC_MEETING_API_URL || undefined,
  supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE || "+914400000000",
  mockFailureRate: Number(process.env.EXPO_PUBLIC_MOCK_FAILURE_RATE || 0),
  // Testing only, until the doctor portal exists: shows the meeting ID so a
  // doctor test app can join the same call.
  showMeetingId: process.env.EXPO_PUBLIC_SHOW_MEETING_ID === "true",
});

// A broken setting shows a clear screen at start-up instead of failing later.
export const envError: string | null = parsed.success
  ? null
  : parsed.error.issues.map((issue) => issue.message).join("\n");

export const env: Env = parsed.success
  ? parsed.data
  : { apiMode: "mock", supportPhone: "+914400000000", mockFailureRate: 0, showMeetingId: false };

export const isMock = env.apiMode === "mock";
