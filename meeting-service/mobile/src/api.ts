export type ParticipantRole = "doctor" | "patient";

export type MeetingParticipant = {
  id: string;
  role: ParticipantRole;
  external_user_reference: string;
  display_name: string | null;
};

export type Meeting = {
  id: string;
  external_appointment_reference: string;
  meeting_type: "one_to_one";
  status: "scheduled" | "ready" | "in_progress" | "ended" | "cancelled" | "failed";
  started_at: string | null;
  ended_at: string | null;
  participants: MeetingParticipant[];
};

export type JoinCredentials = {
  token: string;
  server_url: string;
  participant: { id: string; identity: string; role: ParticipantRole };
  expires_in_seconds: number;
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const demoRoleReferences: Record<ParticipantRole, string> = {
  doctor: "local-doctor",
  patient: "local-patient",
};
// Set only in hosted test APKs. A deployed API rejects the demo headers below.
const hostedTestTokens: Record<ParticipantRole, string | undefined> = {
  doctor: process.env.EXPO_PUBLIC_TEST_DOCTOR_TOKEN,
  patient: process.env.EXPO_PUBLIC_TEST_PATIENT_TOKEN,
};

async function request<T>(
  path: string,
  role: ParticipantRole,
  init: RequestInit = {},
): Promise<T> {
  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("Content-Type", "application/json");
  const hostedTestToken = hostedTestTokens[role];
  if (hostedTestToken) {
    requestHeaders.set("Authorization", `Bearer ${hostedTestToken}`);
  } else {
    requestHeaders.set("X-Demo-Role", role);
    requestHeaders.set("X-Demo-User-Reference", demoRoleReferences[role]);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: requestHeaders,
  });

  const result = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.message ?? `Request failed (${response.status})`);
  }
  return result as T;
}

export async function createMeeting(
  role: ParticipantRole,
  appointmentReference: string,
): Promise<Meeting> {
  const result = await request<{ meeting: Meeting }>("/api/v1/meetings", role, {
    method: "POST",
    headers: { "Idempotency-Key": `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    body: JSON.stringify({
      meeting: {
        external_appointment_reference: appointmentReference,
        participants: [
          { role: "doctor", external_user_reference: demoRoleReferences.doctor, display_name: "Doctor" },
          { role: "patient", external_user_reference: demoRoleReferences.patient, display_name: "Patient" },
        ],
      },
    }),
  });
  return result.meeting;
}

export async function prepareMeeting(role: ParticipantRole, meetingId: string): Promise<Meeting> {
  const result = await request<{ meeting: Meeting }>(`/api/v1/meetings/${meetingId}/prepare`, role, {
    method: "POST",
  });
  return result.meeting;
}

export async function getJoinCredentials(
  role: ParticipantRole,
  meetingId: string,
): Promise<JoinCredentials> {
  return request<JoinCredentials>(`/api/v1/meetings/${meetingId}/join-token`, role, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export async function endMeeting(role: ParticipantRole, meetingId: string): Promise<void> {
  await request<{ meeting: Meeting }>(`/api/v1/meetings/${meetingId}/end`, role, {
    method: "POST",
  });
}

export const demoParticipantReference = (role: ParticipantRole) => demoRoleReferences[role];

