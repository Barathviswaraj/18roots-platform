# Meeting Service API v1

All routes use JSON. The machine-readable contract is [openapi.yaml](openapi.yaml); this page explains it.

## Who calls what

| Caller | Token role | Can do |
| --- | --- | --- |
| Main backend | `service` | Create, read, prepare, end and cancel any meeting |
| Doctor's app | `doctor` | Read, prepare, join and end their own meetings |
| Patient's app | `patient` | Read, prepare, join and end their own meetings |
| LiveKit server | none (signed body) | Send room and participant events |

`MEETING_CREATOR_ROLES` sets who may create meetings. Production should use `service`, so meetings exist only for appointments the main backend has confirmed and paid for. The test APK needs `service,doctor`. A doctor or patient may only create a meeting that includes themselves.

## Login tokens

Meeting routes need `Authorization: Bearer <JWT>` with:

- `iss`: `PLATFORM_JWT_ISSUER`
- `aud`: `PLATFORM_JWT_AUDIENCE` (string or array)
- `sub`: the user's ID in the main backend
- `role`: `doctor`, `patient` or `service`
- `exp`: expiry; keep user tokens short, for example 15 minutes

Ways to sign them:

| Setting | Algorithm | Notes |
| --- | --- | --- |
| `PLATFORM_JWT_SECRET` | HS256 | Shared secret, at least 32 characters. The meeting service could also create tokens with it. |
| `PLATFORM_JWT_PREVIOUS_SECRET` | HS256 | Optional. Accepted during rotation; remove it once old tokens have expired. |
| `PLATFORM_JWT_PUBLIC_KEY` | RS256 or ES256 | Recommended for production. The main backend keeps the private key, so this service can check tokens but never create them. A PEM on one line with `\n` works. |

Local test mode only: `X-Demo-Role: doctor|patient` and `X-Demo-User-Reference: <id>`. These need `ALLOW_DEMO_AUTH=true` with `RAILS_ENV` development or test. Production refuses to start with demo login on.

## Endpoints

### Create a meeting

`POST /api/v1/meetings` with header `Idempotency-Key` (16 to 128 letters, digits, `.`, `_`, `:` or `-`).

```json
{
  "meeting": {
    "external_appointment_reference": "appt-12345",
    "participants": [
      { "role": "doctor", "external_user_reference": "doctor-91", "display_name": "Dr. Example" },
      { "role": "patient", "external_user_reference": "patient-42", "display_name": "Patient" }
    ]
  }
}
```

Returns `201` with the meeting in `scheduled` state. The same key and body returns the first response again. The same key with a different body returns `409 idempotency_conflict`. Only one active meeting can exist per appointment reference.

### Read a meeting

`GET /api/v1/meetings/:id` returns the meeting, including each participant's `joined_at` and `left_at`. A doctor or patient who is not in the meeting gets `404`.

### Prepare the room

`POST /api/v1/meetings/:id/prepare` creates the LiveKit room and moves `scheduled` to `ready`. It is safe to repeat. An ended or cancelled meeting returns `409 invalid_state`. If LiveKit can't be reached, it returns `503 video_provider_unavailable`.

### Get a join token

`POST /api/v1/meetings/:id/join-token` with `{ "role": "doctor" }`. The role must match the caller's token. The response holds a LiveKit token for this person and room only. It allows publishing audio and video, blocks data messages, and expires after 10 minutes. It also holds `server_url`, the LiveKit address the app connects to.

### End the meeting

`POST /api/v1/meetings/:id/end` ends the call for both people. It returns `202` and queues room deletion. A participant or the main backend can end it. Repeating it is safe. Leaving the call on one phone does not end the meeting.

### Cancel the meeting

`POST /api/v1/meetings/:id/cancel`, main backend only, for example when an appointment is cancelled or refunded. It works on scheduled, ready and in-progress meetings and is safe to repeat. An ended meeting returns `409`.

### LiveKit webhook

`POST /api/v1/livekit/webhook`, called by LiveKit. The `Authorization` header is a JWT signed with the LiveKit API secret, holding the body's SHA-256. Duplicate event IDs return `200`, new ones `202`. The service handles `room_started`, `room_finished`, `participant_joined` and `participant_left`, and stores others without acting on them.

### Health

`GET /health/live` answers while the process runs. `GET /health/ready` also checks PostgreSQL and Valkey.

## Events sent to the main backend

Set `EVENTS_WEBHOOK_URL` (https) and `EVENTS_WEBHOOK_SECRET` (at least 32 characters). Each event is a `POST`:

```json
{
  "id": "6f1c...",
  "type": "meeting.ended",
  "occurred_at": "2026-11-10T13:38:40.120Z",
  "data": {
    "meeting": { "id": "...", "status": "ended", "started_at": "...", "ended_at": "...", "participants": [ ... ] },
    "ended_by": "patient"
  }
}
```

| Type | When | Extra fields |
| --- | --- | --- |
| `meeting.created` | Meeting created | |
| `meeting.started` | First person joined | |
| `meeting.ended` | Someone ended it, or LiveKit closed the empty room | `ended_by`: `doctor`, `patient`, `service` or `room_closed` |
| `meeting.cancelled` | Main backend cancelled it | |
| `participant.joined` | Someone joined (also after a reconnect) | `participant` |
| `participant.left` | Someone left | `participant` |

**Checking an event:** the header `X-Meeting-Signature: t=<unix seconds>,v1=<hex>` holds an HMAC-SHA256 of `<t>.<raw body>` made with `EVENTS_WEBHOOK_SECRET`. Compare it in constant time and reject `t` older than 5 minutes. Then store `id` and ignore repeats.

```ruby
t, v1 = request.headers["X-Meeting-Signature"].match(/\At=(\d+),v1=(\h{64})\z/)&.captures
expected = OpenSSL::HMAC.hexdigest("SHA256", ENV["EVENTS_WEBHOOK_SECRET"], "#{t}.#{request.raw_post}")
valid = t && (Time.now.to_i - t.to_i).abs < 300 && ActiveSupport::SecurityUtils.secure_compare(expected, v1)
```

**Delivery:** answer any 2xx within 10 seconds. Anything else is retried with growing gaps, from 30 seconds up to 1 hour, for about a day. After that, the message is kept as failed in the `outbox_messages` table for someone to check. Events can arrive more than once and out of order, so read `data.meeting.status` instead of relying on order.

Events are written in the same database transaction as the change they describe. A crash can delay an event but cannot lose it.

## Rate limits

| Who | Limit | Counted by |
| --- | --- | --- |
| Doctor or patient | 300 requests in 5 minutes | Person (`role` and `sub`) |
| Main backend | 6,000 in 5 minutes (`SERVICE_RATE_LIMIT`) | Service token subject |
| Missing or invalid token | 300 in 5 minutes | IP address |
| LiveKit webhooks | 6,000 in 5 minutes | IP address |

Over the limit returns `429` with `Retry-After`.

## Errors

```json
{ "error": { "code": "invalid_state", "message": "The meeting cannot make that state change" } }
```

| Status | Codes |
| --- | --- |
| 400 | `invalid_request`, `idempotency_key_required` |
| 401 | `unauthorized` |
| 403 | `forbidden` (role not allowed, for example a doctor cancelling) |
| 404 | `not_found` (unknown meeting, or not your meeting) |
| 409 | `invalid_state`, `idempotency_conflict`, `conflict` |
| 422 | `validation_failed` |
| 429 | `rate_limited` |
| 503 | `video_provider_unavailable` |
