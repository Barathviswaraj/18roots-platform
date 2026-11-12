import axios from "axios";
import { z } from "zod";

import { env, isMock } from "@/lib/env";
import { useAuth } from "@/store/auth";
import { ApiError, toApiError } from "./client";
import type { Consultation } from "./schemas";

// Talks to the Phase 1 meeting service (meeting-service/docs/openapi.yaml).

export type CallCredentials = { token: string; serverUrl: string; meetingId: string; demo: boolean };

const joinTokenSchema = z.object({
  token: z.string(),
  server_url: z.string(),
  participant: z.object({ id: z.string(), identity: z.string(), role: z.string() }),
  expires_in_seconds: z.number(),
});
const meetingSchema = z.object({ meeting: z.object({ id: z.string() }) });

const meetingApi = axios.create({ baseURL: env.meetingApiUrl, timeout: 15_000 });

// Demo meetings created against a local meeting service, by consultation.
const demoMeetings = new Map<string, string>();

async function joinLive(consultation: Consultation): Promise<CallCredentials> {
  if (!consultation.meetingId) {
    throw new ApiError(409, "meeting_not_ready", "This consultation has no video room yet");
  }
  const headers = { Authorization: `Bearer ${useAuth.getState().tokens?.accessToken ?? ""}` };
  const path = `/api/v1/meetings/${consultation.meetingId}`;
  await meetingApi.post(`${path}/prepare`, null, { headers });
  const role = useAuth.getState().user?.role === "doctor" ? "doctor" : "patient";
  const { data } = await meetingApi.post(`${path}/join-token`, { role }, { headers });
  const credentials = joinTokenSchema.parse(data);
  return {
    token: credentials.token,
    serverUrl: credentials.server_url,
    meetingId: consultation.meetingId,
    demo: false,
  };
}

// Development only: the meeting service in development mode accepts demo login
// headers, so the app can hold a real call with the meeting test client, which
// joins as "local-doctor" using the meeting ID shown on screen.
async function joinDemo(consultation: Consultation): Promise<CallCredentials> {
  const doctor = { "X-Demo-Role": "doctor", "X-Demo-User-Reference": "local-doctor" };
  const patient = { "X-Demo-Role": "patient", "X-Demo-User-Reference": "local-patient" };
  let meetingId = demoMeetings.get(consultation.id);
  if (!meetingId) {
    const reference = `${consultation.id}-${Date.now()}`;
    const { data } = await meetingApi.post(
      "/api/v1/meetings",
      {
        meeting: {
          external_appointment_reference: reference,
          participants: [
            { role: "doctor", external_user_reference: "local-doctor", display_name: consultation.doctor.name },
            { role: "patient", external_user_reference: "local-patient", display_name: "Patient" },
          ],
        },
      },
      { headers: { ...doctor, "Idempotency-Key": `app-${reference}` } },
    );
    meetingId = meetingSchema.parse(data).meeting.id;
    demoMeetings.set(consultation.id, meetingId);
  }
  await meetingApi.post(`/api/v1/meetings/${meetingId}/prepare`, null, { headers: doctor });
  const { data } = await meetingApi.post(
    `/api/v1/meetings/${meetingId}/join-token`,
    { role: "patient" },
    { headers: patient },
  );
  const credentials = joinTokenSchema.parse(data);
  return { token: credentials.token, serverUrl: credentials.server_url, meetingId, demo: true };
}

export async function getCallCredentials(consultation: Consultation): Promise<CallCredentials> {
  if (!env.meetingApiUrl) throw new ApiError(0, "call_unavailable", "No meeting service is configured");
  try {
    return isMock ? await joinDemo(consultation) : await joinLive(consultation);
  } catch (error) {
    throw toApiError(error);
  }
}
