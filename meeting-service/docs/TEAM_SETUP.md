# 18Roots Meeting Service: Team Setup and Production Review

Checked on 9 November 2026.

**The zip is safe to send and this setup is good for a test, but it is not ready for real patients yet.** No real phone call has been made on it. It needs the production work listed below first.

This meeting service is Phase 1 of 18Roots, and its code is complete (checked on 10 November 2026). Phase 2 builds the main backend, the payment service and the real mobile app. See `docs/ROADMAP.md` in the zip.

## Answers first

| Question | Answer | Why |
| --- | --- | --- |
| Can I send it as a zip? | **Yes** | Use the prepared zip. It leaves out secrets and generated folders. |
| Can it go to production today? | **No** | The APK uses shared test logins, real user login is not built, and the free plans have no backups. There is no monitoring, and no real call has been made. |
| Can it become production-grade? | **Yes** | The design is sound and the Phase 1 code work is done. The remaining work is listed under Production checklist. |
| Is it completely open source? | **Not on Render** | All code libraries are open source. Render and LiveKit Cloud are closed hosted services. Setup C uses only open-source server software. |
| Is it completely secure? | **No** | Good basics are in place, but real login, consent, audit logs and legal review are missing. No system is completely secure, so the goal is a reviewed and tested one. |
| Is it scalable for production? | **Design yes, this setup no** | Video bypasses Rails and Rails can add servers. Free-plan limits apply and no load test has been run. |

## The zip

Send `18roots-meeting-service.zip`. It unpacks to a folder called `meeting-service`, and a copy of this guide is inside at `docs/TEAM_SETUP.md`.

| In the zip | Left out | Why it is left out |
| --- | --- | --- |
| `api/` Rails backend | `.env`, `mobile/.env`, `deploy/.env` | Machine settings and secrets |
| `mobile/` app source and scripts | `.hosted-test-secret`, `mobile/.env.production` | They can create logins for your test server |
| `deploy/` one-server setup | `mobile/node_modules/` (1.7 GB) | `npm ci` recreates it |
| `render.yaml` and `docker-compose.yml` | `mobile/android/` (1.4 GB) | The build script recreates it |
| `docs/` (guides, API contract, roadmap), `.github/` CI, `README.md`, `.env.example` files | Logs, temp files and APKs | Not source code |

A fresh setup needs nothing else, because each person creates their own secrets. To build an APK for a backend that is already running, your teammate also needs `.hosted-test-secret`. Send that through a password manager, never by chat, email or Git.

If you make your own zip, do not zip the whole folder as it stands. It would include the secret files above.

## How it works

```mermaid
flowchart LR
  App[Phones with the APK] -->|HTTPS| API[Rails API]
  API --> DB[(PostgreSQL)]
  API --> VK[(Valkey)]
  Worker[Sidekiq] --> VK
  API -->|rooms| LK[LiveKit]
  Worker -->|delete room| LK
  LK -->|signed webhooks| API
  App <-->|audio and video| LK
```

Rails handles permission and meeting records. LiveKit carries the call.

1. The app creates a meeting in Rails. Its status is `scheduled`.
2. Prepare creates the LiveKit room. The status becomes `ready`.
3. Each person asks Rails for a join token, valid for 10 minutes and for that room only.
4. The phones use those tokens to connect to LiveKit and exchange audio and video.
5. LiveKit sends signed webhooks to Rails. The status becomes `in_progress` and join times are saved.
6. Leave disconnects one phone. End marks the meeting `ended`, and Sidekiq deletes the room.

## Setup A: one computer with Docker and a phone

Use this to develop and to test on one Wi-Fi network. These steps are for Linux and macOS. For Windows, follow section 10 of `docs/PROJECT_RECORD.md`.

| Install | Version |
| --- | --- |
| Docker with Compose | Current |
| Node.js | 22.13 or newer |
| JDK | 17 only. Newer versions fail the native build. |
| Android SDK | Platform 36, build-tools 36.0.0, NDK 27.1.12297006 |
| Test devices | Two: Android phones, or a phone and an emulator |

1. Unpack the zip, then start the backend from the `meeting-service` folder:

   ```bash
   cp .env.example .env && docker compose up --build -d
   ```
2. Check it. You should see `{"status":"ready"}`:

   ```bash
   curl http://localhost:3000/health/ready
   ```
3. Run the automated tests. You should see `43 examples, 0 failures`:

   ```bash
   docker compose run --rm -e RAILS_ENV=test -e DATABASE_URL=postgresql://meeting:local-only-change-me@postgres:5432/meeting_test api sh -lc "bin/rails db:prepare && bundle exec rspec"
   ```
4. Find this computer's Wi-Fi address, such as `192.168.1.20`. In `.env`, set `LIVEKIT_PUBLIC_URL=ws://THAT-ADDRESS:7880` and `LIVEKIT_NODE_IP=THAT-ADDRESS`. Then run `docker compose up -d` again.
5. Copy `mobile/.env.example` to `mobile/.env`. Set `EXPO_PUBLIC_API_URL=http://THAT-ADDRESS:3000` and `EXPO_PUBLIC_LIVEKIT_URL=ws://THAT-ADDRESS:7880`.
6. Allow TCP 3000, 7880, 7881, 8081 and UDP 7882 through the computer's firewall.
7. Build and install the app. Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to the Android SDK first:

   ```bash
   cd mobile && npm ci && npx expo run:android --device
   ```
8. Start the app server with `npx expo start --dev-client --clear`, then follow the Test checklist.

On Linux, if `id -u` is not 1000, set `LOCAL_UID` and `LOCAL_GID` in `.env`. Expo Go cannot run this app, because LiveKit needs native code.

## Setup B: Render, LiveKit Cloud and the APK

Use this to test calls between phones in different places. Render runs the backend. LiveKit has to run elsewhere, because [Render forwards only one public HTTP port per service](https://render.com/docs/web-services) and calls need media ports.

You need accounts on GitHub, Render and LiveKit Cloud. To build the APK you also need Node.js, JDK 17 and the Android SDK listed in Setup A.

1. From the `meeting-service` folder, create the shared secret and display it. Keep it private:

   ```bash
   node mobile/scripts/make-hosted-env.js && cat .hosted-test-secret
   ```
2. Create a project at [cloud.livekit.io](https://cloud.livekit.io). From Settings, API keys, copy the project URL, API key and API secret.
3. Create an empty **private** GitHub repository and upload the folder. When Git asks for a password, use a GitHub access token:

   ```bash
   git init -b main && git add . && git commit -m "Hosted test setup" && git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git && git push -u origin main
   ```
4. In Render, choose New, then Blueprint, and pick the repository. It reads `render.yaml` and asks for five values:

   | Name | Value |
   | --- | --- |
   | `PLATFORM_JWT_SECRET` | The secret from step 1 |
   | `LIVEKIT_API_URL` | `https://YOUR-PROJECT.livekit.cloud` |
   | `LIVEKIT_PUBLIC_URL` | `wss://YOUR-PROJECT.livekit.cloud` |
   | `LIVEKIT_API_KEY` | From LiveKit |
   | `LIVEKIT_API_SECRET` | From LiveKit |
5. When the deploy finishes, open `https://YOUR-SERVICE.onrender.com/health/ready`. You should see `{"status":"ready"}`.
6. In LiveKit Cloud, go to Settings, then Webhooks. Add `https://YOUR-SERVICE.onrender.com/api/v1/livekit/webhook` and select the same API key.
7. Build the APK. Set `JAVA_HOME` to JDK 17 first:

   ```bash
   cd mobile && node scripts/make-hosted-env.js https://YOUR-SERVICE.onrender.com && bash scripts/build-hosted-apk.sh
   ```
8. The APK is at `mobile/android/app/build/outputs/apk/release/app-release.apk`. Share it by Google Drive or similar, and install it on both phones.

The first tap after 15 idle minutes can take about a minute while the free API wakes up. Use test data only.

## Setup C: everything on one open-source server

Use this if the whole backend and video must run on software you control. It has not been run on a real server yet.

- Server: Ubuntu 24.04 or newer, public IPv4 address, SSH access, about 2 GB of memory.
- Open inbound in the provider's firewall: TCP 22, 80, 443, 7881 and UDP 7882.
- On your computer: Node.js, JDK 17 and the Android SDK from Setup A.

From the `meeting-service` folder:

```bash
bash deploy/deploy.sh root@SERVER_IP
```

It creates the secrets, uploads the code, installs Docker, starts every service, waits for HTTPS and builds the APK. Run it again after any code change. To use your own domain, point `api.example.com` and `livekit.example.com` at the server and add `example.com` to the end of the command.

## Test checklist

Tick these off on two devices. For Setup B and C, repeat with the phones in different places.

- [ ] Health address shows `{"status":"ready"}`
- [ ] Phone 1: choose **Doctor**, type a new appointment reference, tap **Create and prepare room**, and a meeting ID appears
- [ ] Phone 1: tap **Join as selected role**
- [ ] Phone 2: choose **Patient**, paste the meeting ID, tap **Join as selected role**
- [ ] Both phones see and hear each other
- [ ] **Mute** and **Camera off** work
- [ ] One phone on mobile data and the other on Wi-Fi still works
- [ ] Wi-Fi off and on briefly shows **Reconnecting…**, then **Connected**
- [ ] **Leave** on one phone keeps the other connected
- [ ] **End meeting** returns that phone to the first screen, and the other shows **Disconnected**
- [ ] Backend logs show `POST "/api/v1/livekit/webhook"` with 202 or 200, not 401

## Troubleshooting

| What you see | Likely cause | Fix |
| --- | --- | --- |
| 500 with `uninitialized constant LiveKit` | Old containers | Run `docker compose up --build -d` |
| Webhook 403, `Blocked hosts: api:3000` | Old containers | Run `docker compose up --build -d` |
| Webhook 401 | API key or secret does not match LiveKit | Use the same key on Render and in the LiveKit webhook |
| Render says `Missing production environment variables` | A Blueprint value is blank | Fill in all five values |
| App shows a network error | Wrong address, or not on the same network in Setup A | Check `mobile/.env`, Wi-Fi and firewall |
| APK gets 401 on every action | Test logins expired after 14 days, or the secret differs | Rebuild the APK with the matching secret |
| APK still uses the old server | Built without the script | Build with `scripts/build-hosted-apk.sh` |
| Connected but no video | Media ports blocked, or wrong `LIVEKIT_NODE_IP` | Open UDP 7882 and TCP 7881, and check the address |
| Works on mobile data but not in an office (Setup C) | The office blocks media ports, and there is no TURN relay yet | Add TURN over TLS on port 443 |
| Create says it conflicts | That appointment reference is still active | End it, or use a new reference |
| Meeting ended by itself | Everyone left, or nobody joined for 30 minutes | Create a new meeting |
| First tap takes about a minute | The free Render service was asleep | Wait, then try again |
| Native build fails | Wrong Java version | Use JDK 17 |
| HTTPS never starts (Setup C) | Port 80 or 443 is closed, or the sslip.io certificate limit was hit | Open the ports, or use your own domain |

## Pros and cons

The project has a strong core, and its weak points are mostly the production work that has not been done yet. Use Setup B for this test. Choose the production hosting after legal review decides whether a third party may handle call media.

### The project

| Area | Pros | Cons |
| --- | --- | --- |
| Separation | Independent service with no shared database. Stores references, not medical records. A written API contract (`docs/openapi.yaml`) and signed events for the main backend. | The main backend (Phase 2) still has to be built and connected. |
| Video path | Phones connect straight to LiveKit, so video never loads Rails. | A separate media service must be run or paid for. |
| Access control | Join tokens last 10 minutes and work for one room only. Only the main backend creates and cancels meetings. Login keys can be rotated or asymmetric. | Real user login is not built. The APK carries shared test logins. |
| Reliability | Repeat requests and duplicate webhooks are safe. Meeting states are enforced. Events and room cleanup are saved with each change and retried, so a crash cannot lose them. | An event that fails for a day is parked for a person to check. Nothing alerts on that yet. |
| Mobile app | One React Native code base with real WebRTC. | Test client only: no login and no call alerts. Background calls are not built. Only Android has been built. |
| Operations | Docker setup, Render Blueprint, one-command server deploy, pinned gem versions and a CI workflow. | CI has not run on GitHub yet. No monitoring, alerts or backups. |
| Testing | 43 automated tests and a 36-step production-mode flow pass. | No real phone call, load test or penetration test yet. |
| Cost | Can start on free plans. | Free plans sleep, expire and cap usage, so production will cost money. |

### Hosting options

|  | Setup B: Render and LiveKit Cloud | Render and your own LiveKit server | Setup C: one server |
| --- | --- | --- | --- |
| Ready in this zip | Yes | Backend only. LiveKit server still to be set up. | Yes, not run on a real server yet |
| Effort to start | Lowest: three accounts | Highest: two places to set up | Medium: one server, one command |
| Starting cost | Free plans | Free backend and a paid server | A paid server |
| Open source | No: both are closed platforms | Video yes, backend host no | Yes, all server software |
| Strict office networks | Handled by LiveKit Cloud's relay | Needs TURN over TLS added | Needs TURN over TLS added |
| Who is in the media path | LiveKit Cloud, a third party | Only your server | Only your server |
| Maintenance | Lowest | Highest | You patch, back up and monitor everything |
| Scaling | Upgrade plans | Add servers for each part | Limited to one server until split up |
| Main risk | Vendor cost, lock-in and data handling | Two systems to keep running | One server failing stops everything |
| Best for | Fast test and early pilot | Control of video with a managed backend | Open-source and full-control needs |

## Open-source status

The software is open source, but the Render route as a whole is not, because Render and LiveKit Cloud are closed hosted services. A licence scan on 9 November 2026 found open-source licences on all 86 Ruby gems and on the app's npm packages. No closed Google libraries such as Play Services or Firebase are in the Android app.

| Part | Licence or status |
| --- | --- |
| LiveKit server and SDKs | Apache-2.0 |
| Caddy, Docker Engine | Apache-2.0 |
| Rails, React Native, Expo | MIT |
| Puma, Valkey | BSD-3-Clause |
| Sidekiq | LGPL-3.0 |
| PostgreSQL | PostgreSQL License |
| Redis 7.4 | Not open source, so it was replaced by Valkey |
| Render, LiveKit Cloud | Closed hosted services |
| Android SDK and NDK | Free to use under Google's licence, not open source. Used only to build the APK. |
| Docker Desktop | Closed. Only used if a Windows computer needs it. |
| This project's own code | No `LICENSE` file yet, so it is not open source until one is added |

Add a `LICENSE` file only if the company decides to publish the code.

## Security status

The core access rules are good, but it is not secure enough for real patients yet. This comes from reading the code, running the API checks and scanning for known vulnerabilities. It is not a professional security audit.

| Area | Status | Detail |
| --- | --- | --- |
| Join tokens | In place | Valid for 10 minutes and one room. Data messages are off. |
| Webhook checks | In place | Signature and body hash are verified. Tampered and wrong-format requests were rejected in testing. |
| Demo login | In place | Production refuses to start with it on, and demo headers returned 401. |
| Stored data | In place | References and display names only, no medical records. |
| Transport | In place | HTTPS is forced for the API, and WebRTC media is encrypted in transit. |
| Container | In place | Rails runs as a non-root user. |
| Rate limit | In place | Per person, a larger limit for the main backend, per IP only for missing or bad tokens, and a separate limit for LiveKit webhooks. Real client IPs behind Render's proxy are not checked yet. |
| Platform tokens | In place | Expiry, issuer and audience are checked. Secrets can be rotated, or the main backend's public key (RS256 or ES256) can be used instead. There is no revocation list, so keep user tokens short. |
| Creating and cancelling meetings | In place | Only roles in `MEETING_CREATOR_ROLES` create meetings, and only the main backend cancels. The test setups also allow the doctor; set it to `service` for production. |
| Events to the main backend | In place | Signed with HMAC-SHA256 and a timestamp. Production requires an `https://` address and a secret of at least 32 characters. |
| Dependencies | In place | `Gemfile.lock` pins every gem and Puma is 7.2.1. See the scan below. |
| Real user login | **Missing** | The APK has a role picker and shared test tokens. Anyone holding the APK can act as the test users. |
| End-to-end encryption | **Missing** | Not turned on, so the video server can access the media. On LiveKit Cloud that is a third party. |
| App signing | **Missing** | The APK uses a debug key, which is not acceptable for release. |
| Consent and audit logs | **Missing** | No record of patient consent or of who did what. |
| Data retention | Partial | An hourly job removes expired keys, LiveKit webhook records after 90 days and delivered events after 30 days. Legal review should confirm these periods. |
| Backups and monitoring | **Missing** | No backups, error tracking or alerts. |
| Penetration test | **Missing** | Not done. |
| Legal review | **Missing** | Have counsel check the rules that apply, such as India's DPDP Act 2023 and Telemedicine Practice Guidelines, and HIPAA for US patients. |

Known-vulnerability scan on 9 November 2026:

- App npm packages: 0 critical, 0 high, 5 moderate and 1 low.
- Ruby gems: 1 of 111 flagged. Puma 6.6.1 has 2 high advisories, [GHSA-2vqw-3mp8-cgmx](https://osv.dev/vulnerability/GHSA-2vqw-3mp8-cgmx) and [GHSA-qpgp-93vx-g8v8](https://osv.dev/vulnerability/GHSA-qpgp-93vx-g8v8). Both need Puma's PROXY protocol option, which this app does not turn on. Puma was upgraded to 7.2.1, the fixed version, on 10 November 2026.
- Container images were not scanned.

## Scalability status

The design can grow, but the free setup only suits a small test. No load test has been run, so there is no proven capacity number yet.

| Current limit | Value | Effect |
| --- | --- | --- |
| LiveKit Cloud free, people at once | 100 | At most 50 two-person calls at once |
| LiveKit Cloud free, monthly minutes | 5,000 participant minutes | About 166 two-person calls of 15 minutes, then new requests fail |
| Render free web service | Sleeps after 15 idle minutes, 750 hours a month | Slow first tap, and Sidekiq sleeps too |
| Render free database | 1 GB, expires after 30 days, no backups | Not suitable for real data |
| Render free Key Value | 25 MB, 50 connections, no persistence | Queued jobs can be lost on a restart |
| API rate limit | 300 requests per 5 minutes per person, 6,000 for the main backend | Phones on one mobile network no longer share a limit, and webhooks have their own |

What already scales well:

- Rails holds no call state, so more instances can be added.
- Video never passes through Rails, so calls add little backend load.
- Two-person rooms are small. [LiveKit can run many nodes](https://docs.livekit.io/transport/self-hosting/distributed/), and each room only has to fit on one node.

What must change first:

- Run Sidekiq as its own paid worker.
- Run migrations as a release step instead of at every start.
- Size database connections, and add a connection pooler if needed.
- Load test the API, and test LiveKit with its `lk load-test` tool.

## Production checklist

These are in priority order. Do not put real patients on the system until the first group is done.

### Before real patients

- [ ] Complete a real two-phone call in different places
- [ ] Finish the legal and privacy review, patient consent, and vendor data agreements
- [ ] Decide whether a third party may handle call media, then choose the hosting
- [ ] Connect the main backend's login and remove the test tokens from the app
- [x] Code: only allowed roles create meetings, and only the main backend cancels
- [ ] Set `MEETING_CREATOR_ROLES=service` once the main backend creates meetings
- [x] Code: rotating secrets, or the main backend's RS256 or ES256 public key
- [ ] Have the main backend issue short-lived tokens signed with its private key
- [ ] Move to paid plans, with a separate Sidekiq worker and backed-up database, and test a restore
- [ ] Sign the app with a real release key
- [x] Commit `Gemfile.lock` and upgrade Puma to 7.2.1
- [ ] Run CI on GitHub, and add dependency and image scans to it
- [x] Give signed webhooks their own rate limit
- [ ] Confirm real client IPs behind the proxy
- [ ] Add error tracking, uptime alerts, and alerts for failed events and queue depth
- [x] Schedule purges of expired keys, old webhook records and delivered events
- [ ] Add audit logs, and confirm retention periods with legal review
- [ ] Run a load test and an independent penetration test
- [ ] If you host LiveKit yourself, add TURN over TLS on port 443

### Soon after launch

- [ ] Decide on end-to-end encryption
- [ ] Add background call support and call alerts in the app
- [ ] Build and test the iOS app
- [x] Add a transactional outbox so room cleanup and events cannot be lost
- [ ] Add a staging environment and automatic deployments

## What has been tested

The code, the zip and the APK build were tested on one computer. Nothing has been tested on real hosting or between real phones. Results are from 9 November 2026, updated for the Phase 1 changes on 10 November.

| Check | Result | Detail |
| --- | --- | --- |
| Zip unpacked into a clean folder | Pass | 88 files, about 180 KB, no secret values inside |
| Automated tests from the zip | Pass | 43 examples, 0 failures |
| Production start from the zip | Pass | Rails started with all code loaded |
| `npm ci` and APK build from the zip | Pass | Signed 55 MB APK. A computer without Gradle caches will take longer. |
| API flow in production mode | Pass | 36 of 36 checks on 10 November, using the real LiveKit server running locally, Redis 7.4 and Sidekiq |
| Events to a stand-in main backend | Pass | Every event arrived once with a valid signature. A forced failure was retried and delivered. |
| CI workflow | Steps pass by hand | Tests, production start and mobile typecheck pass here. Not run on GitHub yet. |
| Health check connection fix | Pass | After 300 checks: 74 connections open before, 0 after |
| Deploy script for Setup C | Rehearsal only | Ran against a fake server |
| Local Docker stack with these fixes | **Not run** | Rebuilding needs a sudo password |
| Render build and deploy | **Not done** | Needs accounts |
| Webhook sent by real LiveKit | **Not done** | Requests hand-signed in LiveKit's format passed |
| Real call between two phones | **Not done** | This is the most important next test |
| Valkey, Caddy and real HTTPS | **Not run** | Sidekiq's documentation lists Valkey 7.2 or newer as supported |
| Windows setup | **Not run** | Written from official documentation |
| Load test and penetration test | **Not done** | Required before production |

## Sources

- [Render: web services and port binding](https://render.com/docs/web-services)
- [Render: free plan limits](https://render.com/docs/free)
- [Render: Key Value](https://render.com/docs/key-value)
- [Render: Blueprint reference](https://render.com/docs/blueprint-spec)
- [Render: Key Value free tier size and connections](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses)
- [LiveKit Cloud: quotas and limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/)
- [LiveKit: ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/)
- [LiveKit: distributed setup](https://docs.livekit.io/transport/self-hosting/distributed/)
- [LiveKit: encryption](https://docs.livekit.io/transport/encryption/)
- [LiveKit: webhooks](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
- [Redis: licences by version](https://redis.io/legal/licenses/)
- [Valkey](https://valkey.io)
- [OSV vulnerability database](https://osv.dev)
- [Expo: local release builds](https://docs.expo.dev/guides/local-app-development/)
