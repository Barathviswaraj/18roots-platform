# 18Roots Meeting Service: complete project record

Checked against the real code and the running service on 9 November 2026. The Phase 1 changes in section 17 were checked on 10 November 2026. The plan for the whole app is in [ROADMAP.md](ROADMAP.md).

Contents:
[1. Status](#1-where-the-project-stands-today) ·
[2. Idea](#2-what-the-project-is) ·
[3. Tech stack](#3-tech-stack) ·
[4. Architecture](#4-how-the-parts-connect) ·
[5. Flow](#5-end-to-end-flow) ·
[6. Data](#6-data-model) ·
[7. API and security](#7-api-and-security) ·
[8. Fixes needed](#8-fixes-needed-before-the-first-call) ·
[9. How it was created](#9-how-it-was-created) ·
[10. Windows setup](#10-set-up-on-a-new-windows-laptop) ·
[11. Ubuntu setup](#11-set-up-on-a-new-ubuntu-laptop) ·
[12. Testing](#12-test-it) ·
[13. Problems log](#13-problems-hit-and-how-they-were-solved) ·
[14. Remaining work](#14-remaining-work) ·
[15. Sources](#15-sources) ·
[16. Hosted test](#16-hosted-test-from-different-places) ·
[17. Phase 1 changes](#17-phase-1-changes-10-november-2026)

---

## 1. Where the project stands today

**The meeting service's Phase 1 code is complete and works in production mode on this laptop. No video call between phones has happened yet, and nothing is hosted yet.** Section 16 has the steps for hosting it and testing from different places.

The "Works" rows below were tested on 9 November 2026 with the fixed code outside Docker: Ruby 3.3.10, Rails in production mode and Sidekiq started the same way as on the server, temporary Postgres 18 and Redis 7.4, and the real LiveKit running on this laptop. Valkey replaced Redis after the first of those runs and has not been run yet.

| Part | State | How this was checked |
| --- | --- | --- |
| Create, read, prepare, token, end and cancel APIs | Works | 36 of 36 end-to-end checks passed on 10 November (section 17), including role limits, key rotation, RS256 tokens, rate limits and wrong-user blocks. |
| Events to the main backend | Works with a stand-in | A local HTTPS receiver got every event once, with valid signatures. A forced failure was retried and delivered. No real main backend exists yet. |
| Rails production start | Works | Booted with the same command the server will use. |
| LiveKit room create and delete | Works | A real room was created with a 30-minute empty timeout, then deleted. |
| Room cleanup | Works | Ending or cancelling a meeting removed its real LiveKit room within seconds, through the outbox and Sidekiq. |
| RSpec tests | Pass | 43 examples, 0 failures. |
| LiveKit webhooks | Code works, real delivery not seen | Requests signed in LiveKit's format were accepted, duplicates were ignored, and wrong hashes were rejected. LiveKit has not delivered one to the fixed code yet. |
| Release APK | Builds | 55 MB, signed, tested with a placeholder address and then removed. Not opened on a phone yet. |
| Deploy script | Rehearsed only | `deploy/deploy.sh` ran against a fake server: secrets, upload and re-run all behaved. `deploy/docker-compose.yml` resolves. Never run on a real server. |
| Docker image | **Not built with these fixes** | Render, the server or CI will build it, now from `Gemfile.lock`. Local Docker needs a sudo password. |
| CI | **Not run yet** | `.github/workflows/ci.yml` runs once the project is on GitHub. Its test, production-start and typecheck steps passed when run here by hand. |
| Valkey, Caddy and real HTTPS | **Not run yet** | Downloading them for a rehearsal here was blocked by a safety rule. First run will be on the server. Sidekiq's docs list Valkey 7.2 or newer as supported. |
| Containers on this laptop | **Still old code** | They still return 500 and 403 until `docker compose up --build -d` runs. Not needed for the hosted test. |
| Hosting | **Not done** | Needs your Render and LiveKit accounts, or your own server (section 16). |
| Video between two phones | **Never done** | The Rails log has no meeting request from any phone. |
| Windows setup (section 10) | **Not run yet** | Written from official docs and the Ubuntu lessons. No Windows machine was available. |

---

## 2. What the project is

A separate service for **one-to-one doctor and patient video consultations**.

- The future 18Roots main app keeps accounts, appointments and medical data.
- This service stores only meeting state and outside references, such as an appointment ID and user IDs.
- The two systems **do not share a database**. They talk through an API.
- Rails decides who may join and hands out short-lived room tokens.
- LiveKit carries the audio and video. Video never passes through Rails.

The Expo mobile app is a **test client only**. Its Doctor and Patient switch is not a login system.

Left out of this first version on purpose: login, appointment rules, group calls, waiting rooms, chat, recording, transcription, screen sharing and billing.

---

## 3. Tech stack

Versions below are what the project actually uses.

### Backend

| Layer | Technology | Version | Job |
| --- | --- | --- | --- |
| Language | Ruby | 3.3.10 | Runs the API |
| Framework | Rails, API-only | 8.1.4.1 | Routes, models, controllers |
| Web server | Puma | 6.6.1 | Serves HTTP on port 3000 |
| Database | PostgreSQL | 17 (alpine) | Source of truth for meetings |
| Queue store and rate limits | Valkey (open-source, Redis-compatible) | 8.1.11 (alpine) | Backs Sidekiq and Rack::Attack |
| Background jobs | Sidekiq | ~> 8.0 | Deletes LiveKit rooms after a meeting ends |
| Video server | LiveKit (self-hosted, open source) | 1.13.9 | Signaling, audio and video |
| Video server client | `livekit-server-sdk` gem | ~> 1.0 | Creates rooms, signs tokens |
| Tokens | `jwt` gem | ~> 2.10 | Checks platform and webhook tokens |
| Security middleware | `rack-attack` 6.8.0, `rack-cors` 2.0.2 | | Rate limit and browser origin rules |
| Tests | `rspec-rails` | ~> 7.1 | 2 model and 9 request examples |
| Containers | Docker, Docker Compose | Compose v5.7.0 on this laptop | Runs all five services |

### Mobile test client

| Item | Version |
| --- | --- |
| React Native | 0.86.3 (New Architecture on) |
| React | 19.2.3 |
| Expo SDK | 57 (`expo` 57.0.24) with `expo-dev-client` 57.0.19 |
| LiveKit React Native SDK | `@livekit/react-native` 3.0.0 |
| WebRTC native module | `@livekit/react-native-webrtc` 144.2.0 |
| LiveKit JS client | `livekit-client` 2.22.3 |
| Expo plugins | `@livekit/react-native-expo-plugin` 1.0.3, `@config-plugins/react-native-webrtc` 15.0.2 |
| Language and build | TypeScript 6.0.3, `babel-preset-expo` ~57.0.12 |

### Android build requirements

| Tool | Version |
| --- | --- |
| Node.js | 22.13 or newer (this laptop used 24.20.0) |
| JDK | **17 only**. Java 25 from Android Studio failed the native build. |
| Android SDK platform and build tools | 36 and 36.0.0 |
| NDK | 27.1.12297006 |
| Gradle, Android Gradle Plugin, Kotlin | 9.3.1, 8.12.0, 2.1.20 |
| Lowest Android version | Android 7 (minSdk 24) |
| App package name | `org.roots18.meetingtest` |

### Why these choices

- **LiveKit:** open source, has a mobile SDK, and forwards media without re-encoding it, which keeps delay low. mediasoup and Janus need much more custom work. Jitsi is a full product and is harder to embed.
- **Separate service:** the 18Roots architecture guide favours a modular monolith for the full product. This meeting service was kept separate by explicit request, joined only through references.
- **Expo development build, not Expo Go:** Expo Go does not contain LiveKit's native WebRTC code.

---

## 4. How the parts connect

```mermaid
flowchart LR
  App[Doctor and patient phones] -->|HTTP: create, prepare, token, end| API[Rails API :3000]
  API --> DB[(PostgreSQL)]
  API --> Valkey[(Valkey)]
  Worker[Sidekiq worker] --> Valkey
  API -->|create room, sign token| LK[LiveKit :7880]
  Worker -->|delete room| LK
  App <-->|signaling :7880, media :7881 TCP and :7882 UDP| LK
  LK -->|signed webhooks| API
```

| Port | Protocol | Used for | Reachable from a phone? |
| --- | --- | --- | --- |
| 3000 | TCP | Rails API | Yes |
| 7880 | TCP | LiveKit signaling (WebSocket) | Yes |
| 7881 | TCP | LiveKit media fallback | Yes |
| 7882 | UDP | LiveKit media (preferred, lowest delay) | Yes |
| 8081 | TCP | Metro, the JavaScript bundler for the debug app | Yes |
| 5432, 6379 | TCP | PostgreSQL, Valkey | No, kept inside Docker |

---

## 5. End-to-end flow

The meeting status moves like this:

```text
scheduled -> ready -> in_progress -> ended
Any of the first three can also go to cancelled or failed.
ended, cancelled and failed are final.
```

| # | Who | What happens | Code |
| --- | --- | --- | --- |
| 1 | Doctor app | Sends the appointment reference, both participants and an `Idempotency-Key`. | `meetings_controller.rb#create` |
| 2 | Rails | Checks the caller is one of the two participants. Saves the meeting as `scheduled`. A retry with the same key returns the first answer. | `idempotent_request.rb` |
| 3 | Doctor app | Asks to prepare the room. | `meetings_controller.rb#prepare` |
| 4 | Rails to LiveKit | Creates a uniquely named room using the server secret. Status becomes `ready`. | `livekit_room_service.rb` |
| 5 | Each phone | Asks for a join token, giving its role. | `meetings_controller.rb#join_token` |
| 6 | Rails | Confirms role and user belong to this meeting. Returns a token valid for 10 minutes, for this room and person only. | `livekit_token_issuer.rb` |
| 7 | Each phone | Connects straight to LiveKit and publishes camera and microphone. | `mobile/App.tsx` |
| 8 | LiveKit to Rails | Sends signed webhooks for room start and finish, and participant join and leave. | `livekit_webhooks_controller.rb` |
| 9 | Rails | Verifies the signature, ignores duplicates, updates status and times. | `livekit_webhook_processor.rb` |
| 10 | Either person | **Leave** disconnects only that phone. The other person stays. | `App.tsx` |
| 11 | Either person | **End meeting** marks it `ended` and queues room removal. | `meetings_controller.rb#end_meeting` |
| 12 | Sidekiq | Deletes the LiveKit room, retrying if LiveKit is down. | `delete_livekit_room_job.rb` |

---

## 6. Data model

All IDs are UUIDs.

| Table | Purpose | Key rules enforced by the database |
| --- | --- | --- |
| `meetings` | Status, room name, appointment reference, start and end times | Unique room name. One **active** meeting per appointment reference. Only `one_to_one`. Valid statuses only. |
| `participants` | The doctor and patient of a meeting, their LiveKit identity, joined and left times | One per role per meeting. Roles limited to doctor and patient. Unique LiveKit identity. |
| `webhook_events` | Short record of each LiveKit event | Unique `event_id`, which is how duplicates are stopped. Full participant metadata is not stored. |
| `idempotency_keys` | Saved replies for safe retries, kept 30 days | Unique scope and key digest. |

---

## 7. API and security

| Method and path | Who can call | Result |
| --- | --- | --- |
| `POST /api/v1/meetings` | Roles in `MEETING_CREATOR_ROLES` (production: `service`) | 201 |
| `GET /api/v1/meetings/:id` | A participant, or `service` | 200 |
| `POST /api/v1/meetings/:id/prepare` | A participant, or `service` | 200 |
| `POST /api/v1/meetings/:id/join-token` | A participant only | 200, with `token`, `server_url`, `participant`, `expires_in_seconds` |
| `POST /api/v1/meetings/:id/end` | A participant, or `service` | 202 |
| `POST /api/v1/meetings/:id/cancel` | `service` only | 200 |
| `POST /api/v1/livekit/webhook` | LiveKit, signed | 202 for new events, 200 for duplicates |
| `GET /health/live`, `GET /health/ready` | Anyone | 200, or 503 if not ready |

Error codes: 400 bad request, 401 not authenticated, 403 role not allowed, 404 unknown meeting or not a member, 409 state or key conflict, 422 validation, 429 rate limited, 503 LiveKit unavailable. Full request examples are in [API.md](API.md).

Security built in:

- The LiveKit secret stays on the server. Phones only receive short-lived, single-room tokens.
- Production requires a signed platform JWT with `iss`, `aud`, `sub`, `role` and `exp`: HS256 with a shared secret (plus an optional previous secret for rotation), or RS256 or ES256 with the main backend's public key.
- The `X-Demo-Role` headers work only in development or test with `ALLOW_DEMO_AUTH=true`. Production refuses to boot with that setting on.
- Production refuses to boot if a required secret is missing.
- Webhooks are checked against LiveKit's signature and a SHA-256 of the raw body.
- Rate limits per person, a larger one for the main backend, per IP only for missing or bad tokens, and a separate one for LiveKit webhooks ([API.md](API.md#rate-limits)).
- Meeting events to the main backend are signed with HMAC-SHA256 and a timestamp.
- Tokens and secrets are filtered out of logs.
- Do not put diagnoses, notes or medical records in meeting or room metadata.

---

## 8. Fixes needed before the first call

All ten were applied to the project files on 9 November 2026. Fixes 1, 3 and 6 to 10 are proven by the tests in section 1. Fix 2 only matters in local Docker. Fixes 4 and 5 apply to the local laptop setup and have not been proven on a phone. The containers on this laptop run the old code until they are rebuilt.

**Fix 1: load the LiveKit gem.** The gem's name differs from its file name, so Rails never loads it. Every meeting call returns 500. In `api/Gemfile`:

```ruby
gem "livekit-server-sdk", "~> 1.0", require: "livekit"
```

**Fix 2: let LiveKit's webhooks through.** Rails development mode rejects the host name `api`. Without this, status never changes to `in_progress` and join times are never saved. In `api/config/environments/development.rb`, inside the `configure` block:

```ruby
config.hosts << "api"
```

**Fix 3: correct the room delete call.** The SDK needs a keyword argument. In `api/app/services/livekit_room_service.rb`:

```ruby
api.room.delete_room(room: room_name)
```

**Fix 4: tell LiveKit its real address.** Inside Docker, LiveKit tends to advertise its private container address (172.x), which a phone cannot reach. The call would then connect but show no video. In `docker-compose.yml`:

```yaml
command: ["--dev", "--bind", "0.0.0.0", "--node-ip", "${LIVEKIT_NODE_IP:-127.0.0.1}"]
```

Then add this to `.env` and `.env.example`, using the laptop's Wi-Fi address:

```env
LIVEKIT_NODE_IP=192.168.x.x
```

To confirm the problem first, look for `nodeIP` in the output of `docker compose logs livekit`.

**Fix 5: point the phone at the laptop.** In `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
EXPO_PUBLIC_LIVEKIT_URL=ws://192.168.x.x:7880
```

These values are read when JavaScript is bundled, so restart Metro with `npx expo start --dev-client --clear`. A full Android rebuild is not needed.

**Fix 6: accept real LiveKit webhooks.** LiveKit signs the base64 form of the body's SHA-256 hash. The code and its test both used the hex form, so every real webhook would have been rejected with 401. `api/app/services/livekit_webhook_verifier.rb` and its spec now use `Digest::SHA256.base64digest`.

**Fix 7: let production start.** `rails/all` loads Active Storage, which crashes production when `config/storage.yml` does not exist. Development mode hid this. `api/config/application.rb` now loads only Active Model, Active Job, Active Record and Action Controller.

**Fix 8: ignore duplicate webhooks safely.** A model uniqueness check made a repeated webhook return 422 instead of 200. `api/app/models/webhook_event.rb` now leaves uniqueness to the database index.

**Fix 9: keep waiting rooms open.** LiveKit closes an unused room after about 5 minutes by default, and that would end the meeting. `api/app/services/livekit_room_service.rb` now sets a 30-minute empty timeout.

**Fix 10: close the health check's connection.** `/health/ready` opened a new queue-store connection on every call and left it open. After 300 checks there were up to 74 open, and Render's free Key Value allows 50. `api/app/controllers/health_controller.rb` now closes it, and the same test showed 0 left open.

After fixes 1 to 4, rebuild the containers. The Gemfile is copied into the image, so a plain restart is not enough:

```bash
docker compose up --build -d
```

Smaller gaps found at the same time, all fixed on 10 November 2026 (section 17):

- `api/Gemfile.lock` did not exist, so gem versions could change between builds.
- The idempotency key purge existed but nothing scheduled it.
- `api/db/schema.rb` did not exist.

Watch these during the first real call. They could not be tested until the fixes are in:

- After everyone has left, LiveKit closes the room about 20 seconds later, and the meeting is then marked `ended`.
- LiveKit may report `room_started` as soon as the room is created. That would show `in_progress` before anyone joins.

---

## 9. How it was created

### Timeline

1. **Requirements chosen:** mobile test client, local Docker, one-to-one calls, open-source stack.
2. **Workspace inspected:** no existing app code, only the 18Roots architecture guide. Everything went into a new `meeting-service/` folder.
3. **Rails API written by hand:** migrations, models, service objects, controllers, routes, jobs.
4. **Production guard added:** signed tokens required, demo role switch limited to development and test.
5. **Expo test client written:** role switch, create and join, camera and mic controls, leave, reconnect status.
6. **Specs and docs written:** RSpec, README, API.md, ARCHITECTURE.md.
7. **Docker installed on Ubuntu 26.04:** startup problems fixed one by one until `/health/ready` answered.
8. **Android tools installed:** Android Studio, SDK, phone paired over Wi-Fi, JDK 17. The Android build finished with `BUILD SUCCESSFUL in 8m 45s`.
9. **`babel-preset-expo` added:** the phone had disconnected before the app could launch.
10. **Session cut off:** a usage limit stopped work while the new-laptop guide was being written.
11. **Full check on 9 November 2026:** real API requests found the problems in section 8.

### Project layout

```text
meeting-service/
├── docker-compose.yml      Local: postgres, valkey (service name redis), livekit, api, sidekiq
├── render.yaml             Backend on Render
├── deploy/                 One-server setup: deploy.sh, server-setup.sh, Compose, Caddyfile
├── .env.example            Copy to .env (local-only secrets)
├── README.md               Quick setup
├── docs/                   ARCHITECTURE.md, API.md, PROJECT_RECORD.md
├── api/                    Rails service
│   ├── Dockerfile          Non-root Ruby image
│   ├── Gemfile
│   ├── app/controllers/    api/v1 base, meetings, livekit_webhooks; health
│   ├── app/models/         meeting, participant, webhook_event, idempotency_key
│   ├── app/services/       platform_authenticator, idempotent_request,
│   │                       livekit_room_service, livekit_token_issuer,
│   │                       livekit_webhook_verifier, livekit_webhook_processor
│   ├── app/jobs/           delete_livekit_room, purge_expired_idempotency_keys
│   ├── config/             routes, environments, initializers, sidekiq, puma
│   ├── db/migrate/         2 migrations, 4 tables
│   └── spec/               Model and request tests
└── mobile/                 Expo test client
    ├── App.tsx             All screens: setup and call
    ├── src/api.ts          Calls to the Rails API
    ├── app.json            Permissions and LiveKit plugins
    └── .env.example        API and LiveKit addresses
```

### Building it again from zero

1. Create `meeting-service/` with `api/`, `mobile/` and `docs/` inside.
2. Create the Rails API. The original files were written by hand, but a generator gives the same starting point:

   ```bash
   rails new api --api --database=postgresql --skip-test --skip-git
   ```

3. Add the gems from section 3. Remember `require: "livekit"` on the LiveKit gem.
4. Write the two migrations from section 6, then the four models with the status rules in `meeting.rb`.
5. Write the services in this order: authentication, idempotency, LiveKit room, LiveKit token, webhook verify, webhook process.
6. Write the routes, controllers and jobs. Set Sidekiq as the Active Job adapter.
7. Write the `Dockerfile` and `docker-compose.yml`, then confirm `/health/ready`.
8. Write the RSpec tests and run them.
9. Create the mobile app:

   ```bash
   npx create-expo-app@latest mobile --template blank-typescript@sdk-57
   ```

10. Install the packages from section 3 at those exact versions, and add both plugins plus camera and microphone permissions to `app.json`.
11. Write `src/api.ts`, then `App.tsx`. Call `registerGlobals()` before anything else from LiveKit.
12. Build with `npx expo run:android --device`, then test with two devices.

---

## 10. Set up on a new Windows laptop

Written from official documentation and the Ubuntu lessons. It has not been run on Windows yet.

**You need:** Windows 10 22H2 (build 19045) or Windows 11 23H2 or newer, 64-bit. At least 8 GB RAM (16 GB is more comfortable), about 40 GB free, hardware virtualization on in BIOS, and an Android phone on the same Wi-Fi.

Docker Desktop needs a paid subscription for commercial use at companies with more than 250 employees or more than $10M yearly revenue. Check this for your company.

Use **PowerShell** for every step.

### Step 1: install the tools

```powershell
winget install --id Docker.DockerDesktop -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id EclipseAdoptium.Temurin.17.JDK -e
winget install --id Google.AndroidStudio -e
```

Restart the laptop. Open **Docker Desktop**, accept the prompts, and wait until it says the engine is running. It uses WSL 2 by default. It does not start by itself after install.

### Step 2: allow long file paths

Android native builds create very deep folders and can pass Windows' 260-character limit. Open PowerShell **as Administrator**:

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

Restart again. Keep the project at a short path: `C:\dev\meeting-service`.

### Step 3: set up Android Studio

1. Open Android Studio and finish the setup wizard with **Standard**. Accept the licenses.
2. Go to **More Actions > SDK Manager**.
3. In **SDK Platforms**, install **Android 16 (Baklava), Android SDK Platform 36**.
4. In **SDK Tools**, tick **Show Package Details**, then install:
   - Android SDK Build-Tools **36.0.0**
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools (latest)
   - NDK **27.1.12297006**
   - CMake **3.31.6** (the default CMake's build tool cannot handle long paths)

### Step 4: set environment variables

In normal PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")

$jdk = (Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory | Where-Object Name -like "jdk-17*" | Select-Object -First 1).FullName
[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdk, "User")

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$jdk\bin", "User")

New-Item -ItemType Directory -Force "$env:USERPROFILE\.gradle" | Out-Null
Add-Content "$env:USERPROFILE\.gradle\gradle.properties" "android.cmakeVersion=3.31.6"
```

**Close PowerShell and open a new one**, then check:

```powershell
java -version
adb version
node -v
docker compose version
```

`java -version` must start with **17**. Node must be 22.13 or newer.

### Step 5: copy the project

First apply the fixes in section 8, so the copy has them. Then on the Ubuntu laptop, from the folder that contains `meeting-service`:

```bash
tar --exclude='node_modules' --exclude='mobile/android' --exclude='mobile/ios' --exclude='.expo' --exclude='api/log/*' --exclude='api/tmp/*' --exclude='.env' -czf ~/meeting-service.tar.gz meeting-service
```

Move `meeting-service.tar.gz` to the Windows laptop's Downloads folder. On Windows:

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
tar -xzf "$env:USERPROFILE\Downloads\meeting-service.tar.gz" -C C:\dev
```

If you use Git instead, run `git config --global core.autocrlf input` before cloning. Windows line endings break `api/bin/rails` inside Linux containers.

### Step 6: find the laptop's Wi-Fi address

```powershell
(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' }).IPv4Address.IPAddress
```

Write it down. It is called `LAPTOP_IP` below. It can change when you change networks.

### Step 7: start the backend

```powershell
cd C:\dev\meeting-service
Copy-Item .env.example .env
notepad .env
```

Add the line `LIVEKIT_NODE_IP=LAPTOP_IP` if it is not there, and set `LIVEKIT_PUBLIC_URL=ws://LAPTOP_IP:7880`. Save. Then:

```powershell
docker compose up --build -d
docker compose ps
curl.exe http://localhost:3000/health/ready
```

The first build takes several minutes. Expect `{"status":"ready"}`. If not, run `docker compose logs --tail=100 api livekit sidekiq`.

### Step 8: open the firewall

Set your Wi-Fi to **Private** in Windows network settings. Then in PowerShell **as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "18Roots Meeting TCP" -Direction Inbound -Protocol TCP -LocalPort 3000,7880,7881,8081 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "18Roots Meeting UDP" -Direction Inbound -Protocol UDP -LocalPort 7882 -Action Allow -Profile Private
```

Check from the phone's browser: `http://LAPTOP_IP:3000/health/ready` should show `ready`.

### Step 9: configure the mobile app

```powershell
cd C:\dev\meeting-service\mobile
Copy-Item .env.example .env
notepad .env
```

```env
EXPO_PUBLIC_API_URL=http://LAPTOP_IP:3000
EXPO_PUBLIC_LIVEKIT_URL=ws://LAPTOP_IP:7880
```

Then:

```powershell
npm install
```

The `npm audit` and `ERESOLVE` messages are warnings. Do not run `npm audit fix --force`.

### Step 10: connect the phone over Wi-Fi

Needs Android 11 or newer. On the phone, turn on **Developer options**, then open **Wireless debugging** and choose **Pair device with pairing code**. Use the real numbers shown on your phone:

```powershell
adb pair PHONE_IP:PAIRING_PORT
```

Type the code when asked. Then look at the main **Wireless debugging** screen for the **different** connection port:

```powershell
adb connect PHONE_IP:CONNECT_PORT
adb devices
```

The phone must show as `device`. Use a USB cable if Wi-Fi keeps dropping.

### Step 11: build and run

```powershell
npx expo run:android --device
```

The first build downloads a lot and can take 15 to 45 minutes or more, depending on your connection. Do not press Ctrl+C. If it fails with a path-length error, delete `android\app\.cxx` and `android\app\build`, then run it again.

The app opens on the phone. Keep this terminal open, because the debug app loads its code from your laptop. Go to section 12.

---

## 11. Set up on a new Ubuntu laptop

Same order as Windows, with these differences.

1. Install Docker Engine and the Compose plugin from [Docker's Ubuntu guide](https://docs.docker.com/engine/install/ubuntu/).
2. Install Node.js 22.13 or newer, and Android Studio with the same SDK packages. CMake 3.31.6 and long paths are not needed.
3. Install JDK 17 with `sudo apt install -y openjdk-17-jdk`, then add this to `~/.bashrc`:

   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export ANDROID_HOME="$HOME/Android/Sdk"
   export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
   ```

4. Find the laptop's address with `ip route get 1.1.1.1 | awk '{print $7; exit}'`.
5. Use `cp` instead of `Copy-Item`. Use `sudo docker compose` unless your user is in the `docker` group.
6. If `id -u` or `id -g` is not 1000, update `LOCAL_UID` and `LOCAL_GID` in `.env`.
7. If `ufw` is on, allow TCP 3000, 7880, 7881, 8081 and UDP 7882.

---

## 12. Test it

### Two-device call

A call needs **two clients**: two phones, or a phone plus an Android emulator. Run `npx expo run:android --device` once per device and pick each from the list.

1. First device: choose **Doctor**, then tap **Create and prepare room**. The meeting ID fills the join box.
2. Second device: choose **Patient**, enter that meeting ID, then tap **Join as selected role**.
3. On the Doctor device, tap **Join as selected role** too.
4. Check that both see and hear each other.
5. Try **Mute** and **Camera off**.
6. Turn Wi-Fi off and on for a moment. The status should show **Reconnecting…** and then **Connected**.
7. Tap **Leave** on one device. The other must stay connected.
8. Tap **End meeting**. The call closes for both.

Creating again with the same appointment reference while the old meeting is active returns a conflict. End the old meeting or change the reference.

### Automated tests

From the `meeting-service` folder:

```bash
docker compose run --rm -e RAILS_ENV=test -e DATABASE_URL=postgresql://meeting:local-only-change-me@postgres:5432/meeting_test api sh -lc "bin/rails db:prepare && bundle exec rspec"
```

### Everyday commands

| Task | Command |
| --- | --- |
| Start | `docker compose up -d` |
| Status | `docker compose ps` |
| Logs | `docker compose logs -f api sidekiq livekit` |
| Stop, keep data | `docker compose down` |
| Restart phone code | `npx expo start --dev-client --clear` |

---

## 13. Problems hit and how they were solved

| # | What appeared | Real cause | Solution |
| --- | --- | --- | --- |
| 1 | `docker: command not found` | Docker not installed | Installed Docker Engine and Compose |
| 2 | Port `5432` already in use | Another PostgreSQL on the laptop | Removed the host port mapping. Postgres and Redis stay inside Docker. |
| 3 | Bundler could not write `/app/Gemfile.lock` | Non-root user on a mounted folder | Keep the Gemfile and lock in `/usr/local/bundle` |
| 4 | Rails could not write `/app/tmp` or `/app/log` | Container user did not match the folder owner | Run as `LOCAL_UID:LOCAL_GID`. Turned off unused image processing. |
| 5 | `spawn adb ENOENT` | Android SDK not installed. `export` only points to a path. | Installed Android Studio and SDK tools |
| 6 | Expo Go could not be used | LiveKit needs native code | Build a development client |
| 7 | `adb pair` protocol fault | Example text typed literally, then a dot instead of `:` | Use the real `IP:port` from the phone |
| 8 | `JAVA_HOME is not set` | No Java on PATH | Set `JAVA_HOME` |
| 9 | Native build failed under Java 25 | Android Studio's bundled Java is too new | Use JDK 17 |
| 10 | `No Android connected device` | Wireless debugging dropped | `adb connect IP:PORT` again. The port changes. |
| 11 | `babel-preset-expo` not found | Missing dependency | Added to `package.json` |
| 12 | Phone could not reach the API | `10.0.2.2` only works in an emulator | Use the laptop's Wi-Fi address (Fix 5) |
| 13 | Rails would not start in production | Active Storage loaded with no `storage.yml` | Load only the frameworks in use (Fix 7) |
| 14 | Real webhooks would get 401 | Hex hash compared with LiveKit's base64 hash | Use the base64 hash (Fix 6) |
| 15 | Duplicate webhook returned 422 | Model check ran before the database index | Remove the model check (Fix 8) |
| 16 | APK kept the old server address | Gradle does not treat `.env.production` as an input | Force the bundle task with `--rerun` (section 16) |
| 17 | Rails 8.1 would not load on Ruby 3.3.0 | Parser bug in Ruby 3.3.0 | Use 3.3.10, the version in the Docker image |
| 18 | Redis 7.4 is not open source | Its licence changed after 7.2 | Replaced with Valkey |
| 19 | Render cannot run LiveKit | It forwards one HTTP port per service, and calls need media ports | Run LiveKit somewhere else (section 16) |
| 20 | Health check left connections open | It never closed its queue-store connection | Close it after each check (Fix 10) |

---

## 14. Remaining work

Before real patients:

- Replace demo headers with real tokens from the main backend (Phase 2). Prefer `PLATFORM_JWT_PUBLIC_KEY`. Rotation is supported.
- Set `MEETING_CREATOR_ROLES=service` once the main backend creates meetings.
- Remove the shared test tokens from the APK (section 16). Anyone holding that APK can act as the two test users.
- Add TURN over TLS on port 443 for networks that block media ports.
- Set `ALLOW_DEMO_AUTH=false` and use a secret manager. Never expose `devkey` and `secret`.
- Serve HTTPS and WSS. Give LiveKit a public address, TLS, TURN and the correct firewall rules.
- Use backed-up PostgreSQL and Valkey.
- Agree retention periods with legal review. The defaults are 90 days for LiveKit webhook records and 30 days for delivered events.
- Add monitoring: failed rows in `outbox_messages`, queue depth, error rates and call quality.
- Run CI on GitHub and add a deploy step.
- Load test the API and LiveKit before launch.
- Complete privacy, consent and legal review. Recording is off in this version.

Docker Compose here is for local development. It is not a production deployment.

---

## 15. Sources

- [Expo: Windows long paths](https://docs.expo.dev/troubleshooting/windows-long-paths/)
- [Expo: environment setup](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local)
- [Expo: SDK version table](https://docs.expo.dev/versions/latest/)
- [Docker Desktop on Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
- [LiveKit: ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/)
- [LiveKit Ruby SDK source](https://github.com/livekit/server-sdk-ruby)
- [LiveKit issue on `--node-ip` in Docker](https://github.com/livekit/livekit/issues/4049)
- [Local LiveKit in Docker advertising a container IP](https://docs.memberjunction.org/api/media/README-31.md)
- [Android wireless debugging](https://developer.android.com/tools/adb)
- [Render: web services and port binding](https://render.com/docs/web-services)
- [Render: free plan limits](https://render.com/docs/free)
- [Render: Blueprint reference](https://render.com/docs/blueprint-spec)
- [Render: Key Value](https://render.com/docs/key-value)
- [LiveKit Cloud: quotas and limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/)
- [LiveKit: webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
- [LiveKit: webhook hash in the protocol source](https://github.com/livekit/protocol/blob/main/webhook/verifier.go)
- [Redis: licences by version](https://redis.io/legal/licenses/)
- [Valkey](https://valkey.io)
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat)
- [Let's Encrypt: rate limits](https://letsencrypt.org/docs/rate-limits/)
- [Expo: local release builds](https://docs.expo.dev/guides/local-app-development/)

---

## 16. Hosted test from different places

Phones in different places cannot reach this laptop, so the backend has to be online and the app goes out as an APK. There are two ways to host it:

- **[Backend on Render](#backend-on-render), with LiveKit somewhere else.** Nothing to administer, but Render is a closed platform.
- **[Everything on one Linux server](#one-server-setup).** All the server software is open source.

The API runs in real production mode, which rejects the demo headers. The APK therefore carries two signed test tokens, for `local-doctor` and `local-patient`, that expire after 14 days.

### Backend on Render

Render forwards only one public HTTP port per service, so it cannot carry call media. LiveKit has to run somewhere phones can reach. LiveKit Cloud's free Build plan is the simplest, and includes 5,000 participant minutes. Your own LiveKit server works with the same settings.

| Part | Where it runs | Note |
| --- | --- | --- |
| Rails API and Sidekiq | One free Render web service | The free plan has no background workers, so `api/bin/render-start` runs both. |
| PostgreSQL | Render free database | Expires 30 days after it is created. |
| Queue store | Render free Key Value (Valkey 8) | Data is not kept across restarts. |
| LiveKit | LiveKit Cloud or your own server | Holds the calls. |
| App | Release APK | Built on this laptop, shared as a file. |

1. **LiveKit:** create a project at [cloud.livekit.io](https://cloud.livekit.io). From Settings, API keys, copy the project URL, API key and API secret.
2. **GitHub:** create an empty private repository, then upload the `meeting-service` folder:

   ```bash
   git init -b main && git add . && git commit -m "Hosted test setup" && git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git && git push -u origin main
   ```

3. **Render:** choose New, then Blueprint, and pick the repository. It reads `render.yaml` and asks for five values:

   | Name | Value |
   | --- | --- |
   | `PLATFORM_JWT_SECRET` | In `meeting-service`, run `node mobile/scripts/make-hosted-env.js`, then `cat .hosted-test-secret` |
   | `LIVEKIT_API_URL` | `https://YOUR-PROJECT.livekit.cloud` |
   | `LIVEKIT_PUBLIC_URL` | `wss://YOUR-PROJECT.livekit.cloud` |
   | `LIVEKIT_API_KEY` | From LiveKit |
   | `LIVEKIT_API_SECRET` | From LiveKit |

4. **Check it:** open `https://YOUR-SERVICE.onrender.com/health/ready`. It should show `{"status":"ready"}`.
5. **Webhook:** in LiveKit Cloud, Settings, Webhooks, add `https://YOUR-SERVICE.onrender.com/api/v1/livekit/webhook` and select the same API key.
6. **Build the APK** from `meeting-service/mobile`:

   ```bash
   node scripts/make-hosted-env.js https://YOUR-SERVICE.onrender.com
   ```

   ```bash
   bash scripts/build-hosted-apk.sh
   ```

7. **Share the APK** by Google Drive or similar, and install it on both phones. Android will ask to allow installing from that app.

The free API sleeps after 15 idle minutes. The first tap after that can take about a minute.

### One-server setup

```mermaid
flowchart LR
  App[Phones with the APK] -->|HTTPS 443| Caddy[Caddy: automatic HTTPS]
  App -->|WSS 443| Caddy
  App <-->|media: 7882 UDP, 7881 TCP| LK[LiveKit]
  Caddy --> API[Rails API]
  Caddy --> LK
  API --> DB[(PostgreSQL)]
  API --> VK[(Valkey)]
  Worker[Sidekiq] --> VK
  API -->|rooms and tokens| LK
  Worker -->|delete room| LK
  LK -->|webhooks inside Docker| API
```

### Open-source check

| Part | Licence |
| --- | --- |
| LiveKit server and SDKs | Apache-2.0 |
| Caddy | Apache-2.0 |
| Docker Engine (Moby) | Apache-2.0 |
| Rails | MIT |
| Puma | BSD-3-Clause |
| Sidekiq | LGPL-3.0 |
| PostgreSQL | PostgreSQL License |
| Valkey (replaces Redis 7.4, which is not open source) | BSD-3-Clause |
| React Native, Expo | MIT |

A scan on 9 November 2026 found open-source licences on all 86 gems and on the app's npm packages. The one exception is `caniuse-lite`, a browser-data table under CC-BY-4.0, which is an open content licence. No closed Google libraries such as Play Services or Firebase are in the Android app.

Still not open source, and none of it runs on the server:

- Google's Android SDK and NDK, used to build the APK. They are free to use, under Google's licence.
- Docker Desktop, if you use the Windows setup in section 10.
- The rented server itself. Let's Encrypt issues the certificates. sslip.io provides the free hostnames, and your own domain replaces it.

This project's own code has no `LICENSE` file yet. Add one before publishing it as open source.

### What you need

- An Ubuntu 24.04 or newer server with a public IPv4 address, SSH access, and at least 2 GB of memory (an estimate, because the build compiles native gems).
- In the provider's firewall, inbound TCP 22, 80, 443 and 7881, and UDP 7882.

### Deploy

From the `meeting-service` folder on this laptop:

```bash
bash deploy/deploy.sh root@SERVER_IP
```

It creates the secrets in `deploy/.env`, uploads `api` and `deploy`, installs Docker from Ubuntu's packages, starts all services, waits for HTTPS, and builds the APK at `mobile/android/app/build/outputs/apk/release/app-release.apk`. Run it again after any code change. To use your own domain, point `api.example.com` and `livekit.example.com` at the server and add `example.com` to the command.

Share the APK by Google Drive or similar, and install it on both phones. Android will ask to allow installing from that app.

### Run the call

1. Phone 1: choose **Doctor**, type a new appointment reference, and tap **Create and prepare room**.
2. Send the meeting ID from the join box to the other person.
3. Phone 1: tap **Join as selected role**.
4. Phone 2: choose **Patient**, paste the ID, and tap **Join as selected role**. The room waits up to 30 minutes.
5. Check video and sound both ways. Repeat with one phone on mobile data and one on Wi-Fi.
6. Tap **Leave** on one phone. The other must stay connected.
7. Tap **End meeting**. That phone returns to the first screen and the other shows **Disconnected**.

To check webhooks on Render, look in the service's Logs tab for `POST "/api/v1/livekit/webhook"`. On your own server, run this. The result should be 202 or 200, not 401:

```bash
cd 18roots-meeting/deploy && docker compose logs api | grep -A3 livekit/webhook
```

### Limits

- Test data only. Do not use real patient details on this setup.
- The APK's tokens expire after 14 days. Build a new APK after that, and share it only with your testers.
- There are no database backups in either setup.
- On your own server, there is no TURN relay yet. A network that blocks everything except web ports, as some offices do, cannot carry the media. If one place fails, that is the first thing to check.
- On your own server without a domain, sslip.io shares one Let's Encrypt limit with everyone using it, because it is not on the Public Suffix List. If HTTPS will not start, use your own domain.

---

## 17. Phase 1 changes (10 November 2026)

These turn the starter into a service the main backend and payment flow can rely on. [ROADMAP.md](ROADMAP.md) explains where they fit.

| Change | Why | Files |
| --- | --- | --- |
| Only roles in `MEETING_CREATOR_ROLES` create meetings (production: `service`). A doctor or patient can no longer create a meeting naming someone else. | Meetings should only exist for confirmed, paid appointments. | `meetings_controller.rb` |
| `GET /api/v1/meetings/:id` and `POST /api/v1/meetings/:id/cancel` (service only). | The app needs to show status; the main backend must cancel on refund. | `meetings_controller.rb`, `routes.rb` |
| Participant `joined_at` and `left_at` in responses. | Shows whether the doctor actually joined, which matters for refunds. | `meeting_presenter.rb` |
| Signed events to the main backend through a transactional outbox. | The main backend learns when a call starts and ends, and a crash cannot lose an event. | `meeting_events.rb`, `outbox_message.rb`, `outbox_dispatch_job.rb`, `event_webhook_delivery.rb`, new migration |
| Room cleanup through the same outbox. | Cleanup survives a queue-store outage. | `outbox_dispatch_job.rb` (replaces `DeleteLivekitRoomJob`) |
| Recurring jobs inside Sidekiq: outbox sweep every minute, purge every hour. | Nothing scheduled the purge before; no extra service is needed. | `recurring_job_scheduler.rb`, `purge_expired_records_job.rb`, `config/initializers/sidekiq.rb` |
| Previous secret for rotation; RS256 or ES256 public key. | Secrets can be changed without logging everyone out; the meeting service no longer needs to be able to forge tokens. | `platform_authenticator.rb`, `production_safety.rb` |
| Rate limits per person, per service, per IP for bad tokens, and a separate webhook limit. | Phones on one mobile network share an IP; webhooks shared the API limit. | `config/initializers/rack_attack.rb` |
| An event or cleanup is saved even if the queue store is down at that moment; the sweep delivers it later. | Before, the request would fail with 500 after the change was already saved. | `outbox_message.rb` |
| `prepare` calls LiveKit outside the database lock. | A slow video server could hold locks and connections. | `meetings_controller.rb` |
| LiveKit unreachable returns 503 instead of 500. | Clearer errors for the app. | `base_controller.rb` |
| `Gemfile.lock`, Puma 7.2.1, frozen Docker install, `db/schema.rb`. | Same gem versions everywhere; Puma 6.6.1 had two advisories. | `api/Gemfile`, `api/Gemfile.lock`, `api/Dockerfile` |
| OpenAPI contract and CI workflow. | The Phase 2 teams build against a fixed contract; every change gets tested. | `docs/openapi.yaml`, `.github/workflows/ci.yml` |
| Mobile typecheck fixed: Expo env types and a wrong import. | CI runs it; the APK build was not affected. | `mobile/expo-env.d.ts`, `mobile/App.tsx` |

**How it was checked.** RSpec ran with 43 examples and 0 failures, with eager loading on as in CI. Mutation checks confirmed the lock test fails with the LiveKit call back inside the lock, and the queue-outage test fails without its fix. The end-to-end run started the API and Sidekiq in production mode on this laptop, with Postgres 18, Redis 7.4, the local LiveKit, fresh random secrets, and an HTTPS stand-in for the main backend. All 36 checks passed, covering the role limits, a previous-secret token, an RS256 token, real room creation and deletion, signed webhooks and duplicates, events with valid signatures, a forced delivery failure with its retry, the cancel path, per-IP versus per-person rate limits, and the recurring job claims. The Docker image, Valkey and GitHub CI were not run here.

**Settings added:** `MEETING_CREATOR_ROLES`, `PLATFORM_JWT_PREVIOUS_SECRET`, `PLATFORM_JWT_PUBLIC_KEY`, `EVENTS_WEBHOOK_URL`, `EVENTS_WEBHOOK_SECRET` and `SERVICE_RATE_LIMIT`. `render.yaml` and `deploy/docker-compose.yml` set `MEETING_CREATOR_ROLES=service,doctor` so the test APK keeps working; change it to `service` once the main backend exists. Production now refuses to start with a platform secret shorter than 32 characters, an `http://` events URL, or a private key in `PLATFORM_JWT_PUBLIC_KEY`.
