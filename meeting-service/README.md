# 18Roots Meeting Service

An independent Rails API for one-to-one doctor-patient video meetings. It stores only meeting state and external appointment/user references; it does not connect to the future 18Roots application's database.

The starter includes Rails API, PostgreSQL, Valkey, Sidekiq, self-hosted LiveKit, and a React Native + Expo local test client. The API image is a production-style, non-root container. Docker Compose is the local development setup; it is not a complete production deployment.

New to this project? Start with [docs/TEAM_SETUP.md](docs/TEAM_SETUP.md). It covers setup, testing, pros and cons, and production readiness. The plan for the full app is in [docs/ROADMAP.md](docs/ROADMAP.md): this service is Phase 1, and the main backend, payment service and mobile app are Phase 2.

## Stack

- Ruby 3.3 and Rails 8.1 API-only
- PostgreSQL 17
- Valkey 8.1 (open-source, Redis-compatible) and Sidekiq 8
- LiveKit server 1.13.9
- React Native 0.86, Expo SDK 57, and LiveKit React Native SDK 3
- RSpec request and model specs

The Expo client uses a development build because LiveKit's native WebRTC module does not run in Expo Go. The versions follow the current LiveKit Expo quickstart sample.

## First-time setup

### 1. Install Docker

Install and start Docker Desktop for your operating system, or Docker Engine with the Compose plugin on Linux. Docker Desktop includes the `docker compose` command.

- [Install Docker Desktop](https://docs.docker.com/get-started/get-docker/)
- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Compose overview](https://docs.docker.com/compose/)

After installation, open Docker Desktop and wait until it reports that the engine is running. Then verify in a terminal:

```sh
docker --version
docker compose version
```

### 2. Start the local services

From this `meeting-service/` folder:

```sh
cp .env.example .env
docker compose up --build -d
```

On Windows PowerShell, use `Copy-Item .env.example .env` for the first command. Rails creates the local database and runs migrations when the API container starts.

On Linux, the Compose setup runs the API and worker with the host user's numeric ID so they can write Rails temporary files and logs in the mounted project folder. The sample uses `1000:1000`; if `id -u` or `id -g` returns different values, update `LOCAL_UID` and `LOCAL_GID` in `.env` before starting.

The API is available at `http://localhost:3000`. Check that the API, PostgreSQL, and Valkey are ready:

```sh
curl http://localhost:3000/health/ready
```

Expected response: `{"status":"ready"}`. LiveKit signaling uses port `7880`; local media uses TCP `7881` and UDP `7882`.

Use `docker compose logs -f api sidekiq livekit` to see startup and runtime logs.

### 3. Build the Expo development client

Install Node.js 22, Android Studio and its Android SDK for Android testing, or Xcode for iOS testing on macOS. LiveKit needs a native development build, so Expo Go is not sufficient.

From `meeting-service/mobile/`, create the client environment file:

```sh
cp .env.example .env
npm install
```

Use the right host addresses for the device:

| Test device | `EXPO_PUBLIC_API_URL` | `EXPO_PUBLIC_LIVEKIT_URL` |
| --- | --- | --- |
| iOS simulator | `http://localhost:3000` | `ws://localhost:7880` |
| Android emulator | `http://10.0.2.2:3000` | `ws://10.0.2.2:7880` |
| Physical phone | `http://<computer-LAN-IP>:3000` | `ws://<computer-LAN-IP>:7880` |

For a physical phone, put the phone and computer on the same Wi-Fi network, replace `<computer-LAN-IP>` in `mobile/.env` with the computer's LAN IPv4 address, set `LIVEKIT_NODE_IP` in the root `.env` to that same address and rerun `docker compose up -d`, and allow the local ports through the computer firewall. The media path also needs UDP `7882` and TCP `7881` reachable from the phone.

Build and install a native development client, then start the JavaScript bundler:

```sh
npx expo run:android
# or, on macOS with Xcode:
npx expo run:ios

npm run start
```

Open the installed development client on the simulator/device. On the first launch, select Doctor or Patient. Create a meeting once, then enter the displayed meeting ID on the second device and join as the other role. The test client uses fixed local demo identities (`local-doctor` and `local-patient`); do not use it as an authentication pattern for a deployed app.

## Useful commands

```sh
# Follow service logs
docker compose logs -f api sidekiq livekit

# Run the RSpec suite against a separate test database
docker compose run --rm \
  -e RAILS_ENV=test \
  -e DATABASE_URL=postgresql://meeting:local-only-change-me@postgres:5432/meeting_test \
  api sh -lc 'bin/rails db:prepare && bundle exec rspec'

# Stop containers while keeping local database/Redis volumes
docker compose down
```

The tests use Rails' test job adapter and stub LiveKit room creation; they do not need a LiveKit call. The request specs need PostgreSQL. On Linux, if `docker` reports a permission error, follow the Docker Engine post-install instructions for your user.

## Hosted test from different places

To test calls between phones on different networks, host the backend and install a release APK. `render.yaml` puts the backend on Render, with LiveKit running somewhere else because Render cannot carry call media. `bash deploy/deploy.sh root@SERVER_IP` puts every service on one Ubuntu server instead, using only open-source server software. See [section 16 of the project record](docs/PROJECT_RECORD.md#16-hosted-test-from-different-places).

## API overview

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the product idea, system diagram, end-to-end consultation sequence, ownership boundaries, and rollout plan. See [docs/API.md](docs/API.md) for request/response examples, the platform JWT contract and the events sent to the main backend, and [docs/openapi.yaml](docs/openapi.yaml) for the machine-readable contract.

- `POST /api/v1/meetings` creates a one-to-one meeting; requires `Idempotency-Key`. Only roles in `MEETING_CREATOR_ROLES` may call it (production: the main backend's `service` role).
- `GET /api/v1/meetings/:id` returns status and each participant's join and leave times.
- `POST /api/v1/meetings/:id/prepare` creates the LiveKit room and marks it ready.
- `POST /api/v1/meetings/:id/join-token` issues a short-lived, room-scoped participant token.
- `POST /api/v1/meetings/:id/end` marks the meeting ended and queues room cleanup through the outbox.
- `POST /api/v1/meetings/:id/cancel` (main backend only) cancels a meeting for a cancelled or refunded appointment.
- Signed events (`meeting.created`, `meeting.started`, `meeting.ended`, `meeting.cancelled`, `participant.joined`, `participant.left`) go to `EVENTS_WEBHOOK_URL` when it is set.
- `POST /api/v1/livekit/webhook` verifies LiveKit's signature over the raw request body and deduplicates event IDs.
- `GET /health/live` and `GET /health/ready` expose liveness and dependency readiness.

## Production boundary and remaining work

This starter is designed to grow into a production service, but Compose and the local LiveKit settings are for development. Before serving real consultations:

- Set `ALLOW_DEMO_AUTH=false` and `MEETING_CREATOR_ROLES=service`; inject production secrets from a secret manager. The API validates platform JWTs (HS256 with an optional previous secret for rotation, or RS256/ES256 with `PLATFORM_JWT_PUBLIC_KEY`) with issuer, audience, expiry, subject, and role claims.
- Put Rails behind HTTPS/WSS termination with a trusted proxy. Configure LiveKit's public address, TLS, TURN, and the required WebRTC firewall rules for the target network. Do not expose the local `devkey`/`secret` pair.
- Use managed/backed-up PostgreSQL and Valkey, separate production credentials, point-in-time recovery, connection/pool sizing, and a deployment process with health checks and graceful shutdown.
- Confirm retention periods (defaults: 90 days for LiveKit webhook records, 30 days for delivered events; idempotency keys expire after 30 days). Monitor failed rows in `outbox_messages`, queue depth, database capacity, LiveKit media quality, and rate-limit behavior behind the production proxy.
- Complete privacy, consent, incident response, retention, and jurisdictional review before real patient use. Recording and egress are not enabled by this starter.
- CI is in `.github/workflows/ci.yml` (tests, production start, image build, mobile typecheck); add a deploy step for the chosen host. The Dockerfile builds a non-root image from `Gemfile.lock`; the Compose file mounts source code and uses local development secrets.

The role header switch is accepted only when Rails runs in development/test and `ALLOW_DEMO_AUTH=true`. Production startup rejects that setting and protected API routes require a signed bearer token.

