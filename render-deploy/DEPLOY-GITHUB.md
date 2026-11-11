# Deploy 18Roots to Render from GitHub: step by step

This way needs a GitHub account: Render builds the code from your repository with the Blueprint in `render.yaml`. **No GitHub account?** Follow `DEPLOY.md` instead: it uploads ready-built images through Docker Hub.

At the end you'll have:
- **The main backend and the meeting service** running on Render's free plan.
- **Video calls** running on LiveKit Cloud.
- **Two Android apps:**
  - the patient app (`18roots-app-render.apk`)
  - a doctor test app (`18roots-doctor-test.apk`), so two phones can hold a real call from different places

The steps take about an hour. Run every command from the project folder:

```bash
cd /home/vakilsearch/.codex/.chatgpt-projects/g-p-6ad31df6ca80819181510ddf2f4d548d
```

## What this setup is (and isn't)

- **One file does all of Render:** `render.yaml` creates both services, one PostgreSQL database and one Key Value store.
- **Shared database and store:** a free workspace allows only one of each.
  - The two services share the database, each in its own schema (`meeting` and `backend`).
  - They share the store, with separate job queues.
- **It's a test server:**
  - Every login code is **123456**.
  - Payments are demo payments; no money moves.
  - Demo doctors and a demo patient are loaded automatically.
  - Join opens a day before each consultation.
  - Don't put real patients on it.
- **Free-plan limits:**
  - **Sleeping:** each service sleeps after 15 idle minutes, and the first request then takes about a minute.
  - **Database expiry:** the free database is **deleted 30 days after creation** (plus a 14-day grace period).
  - **Hours:** the workspace gets 750 free service hours a month.
  - **LiveKit Cloud's free plan** allows about 5,000 participant minutes a month.
- **Already tested on this laptop:** this exact setup ran in production mode with one shared database and one shared store, and 30 of 30 checks passed. Render itself hasn't been tried yet.

## Step 1: create the accounts

1. **GitHub:** <https://github.com>. A free account is enough.
2. **Render:** <https://dashboard.render.com>. Sign up with your GitHub account so Render can read your repository.
3. **LiveKit Cloud:** <https://cloud.livekit.io>. A free account is enough.

## Step 2: make the secrets (on this laptop)

```bash
node render-deploy/make-secrets.js
```

This creates two files. Both are ignored by Git:

| File | What it holds |
| --- | --- |
| `render-deploy/secrets.local.txt` | The four values you'll paste into Render |
| `render-deploy/jwt-private.pem` | The backend's private key, used later to make the doctor test login |

Open `secrets.local.txt` in a text editor when Render asks for the values. Never paste these values into chat, email or GitHub.

## Step 3: set up LiveKit Cloud

1. In LiveKit Cloud, create a project. Any name works, for example `18roots-test`.
2. Open **Settings**, then **API Keys**, and create a key. Copy the **API key** and the **API secret**. The secret is shown only once.
3. Note your project URL. It looks like `wss://18roots-test-abc123.livekit.cloud`.

You'll need these four values in Step 5:

| Render setting | Value |
| --- | --- |
| `LIVEKIT_PUBLIC_URL` | The project URL as shown: `wss://….livekit.cloud` |
| `LIVEKIT_API_URL` | The same URL, starting with `https://` instead of `wss://` |
| `LIVEKIT_API_KEY` | The API key |
| `LIVEKIT_API_SECRET` | The API secret |

## Step 4: put the code on GitHub

1. Build a clean copy of the projects. It contains no secrets, no `node_modules` and no build folders, and it's committed to Git for you:

   ```bash
   bash render-deploy/prepare-repo.sh
   ```

   It creates `~/18roots-platform`. If Git asks who you are, run these two commands, then run the script again:

   ```bash
   git config --global user.name "Your Name"
   ```

   ```bash
   git config --global user.email "you@example.com"
   ```

2. On GitHub, create a **private** repository named `18roots-platform`. Leave it empty: no README, `.gitignore` or license.

3. Push the code. Replace `YOUR-NAME` with your GitHub user name:

   ```bash
   cd ~/18roots-platform && git remote add origin https://github.com/YOUR-NAME/18roots-platform.git && git push -u origin main
   ```

   When Git asks for a password, use a GitHub **personal access token**, not your GitHub password. Create one under GitHub, then **Settings**, **Developer settings**, **Personal access tokens**, with the **repo** permission.

## Step 5: create everything on Render

1. In the Render dashboard, click **New**, then **Blueprint**.
2. Pick the `18roots-platform` repository. If it isn't listed, use **Configure account** to give Render access to it.
3. Leave the Blueprint path as `render.yaml`. Give the Blueprint any name.
4. Render lists four things: `roots18-meeting-api`, `roots18-main-backend`, `roots18-queue` and `roots18-db`. It asks for the values below. Copy each one exactly, with no spaces before or after.

   **roots18-meeting-api:**

   | Setting | Value |
   | --- | --- |
   | `PLATFORM_JWT_PUBLIC_KEY` | From `secrets.local.txt`. It's one long line that starts with `-----BEGIN PUBLIC KEY-----\n` |
   | `EVENTS_WEBHOOK_SECRET` | From `secrets.local.txt` |
   | `EVENTS_WEBHOOK_URL` | `https://roots18-main-backend.onrender.com/webhooks/meetings` (you'll confirm it in Step 6) |
   | `LIVEKIT_API_URL`, `LIVEKIT_PUBLIC_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | From Step 3 |

   **roots18-main-backend:**

   | Setting | Value |
   | --- | --- |
   | `JWT_PRIVATE_KEY` | From `secrets.local.txt`. It's one long line that starts with `-----BEGIN PRIVATE KEY-----\n` |
   | `MEETING_EVENTS_SECRET` | From `secrets.local.txt`. It's the same value as `EVENTS_WEBHOOK_SECRET` |
   | `MEETING_SERVICE_URL` | `https://roots18-meeting-api.onrender.com` (you'll confirm it in Step 6) |

5. Click **Apply**. Render creates the database and the store, then builds both services. The first build takes about 5 to 10 minutes each.

## Step 6: confirm the addresses

1. Open each service in the Render dashboard. Its address is at the top, for example `https://roots18-main-backend.onrender.com`.
2. If Render added letters to either name, for example `roots18-main-backend-x7k2.onrender.com`, update the setting that points at it, then click **Save changes**. Render redeploys that service.
   - Meeting service: **Environment**, `EVENTS_WEBHOOK_URL` = `https://<real backend address>/webhooks/meetings`.
   - Main backend: **Environment**, `MEETING_SERVICE_URL` = `https://<real meeting address>`.
3. Open these three pages in a browser. The first visit can take a minute while a service wakes up.

   | Page | You should see |
   | --- | --- |
   | `https://<backend>/health/ready` | `{"status":"ready"}` |
   | `https://<meeting>/health/ready` | `{"status":"ready"}` |
   | `https://<backend>/.well-known/jwks.json` | A key starting `{"keys":[{"kty":"RSA"` |

## Step 7: connect LiveKit's webhook

1. In LiveKit Cloud, open **Settings**, then **Webhooks**, and add a webhook.
2. URL: `https://<meeting>/api/v1/livekit/webhook`.
3. Signing key: the same API key you put in Render.

## Step 8: build the two APKs (on this laptop)

You need Node.js, JDK 17 and the Android SDK, which this laptop has. Each build takes a few minutes. Replace the two addresses with your real ones.

**Patient app:**

```bash
bash render-deploy/build-patient-apk.sh https://roots18-main-backend.onrender.com https://roots18-meeting-api.onrender.com
```

The result is `18roots-app-render.apk` in the project folder.

**Doctor test app:** this is the meeting test app, signed in as the demo doctor, Dr. Meera Krishnan, for 14 days.

```bash
bash render-deploy/build-doctor-apk.sh https://roots18-main-backend.onrender.com https://roots18-meeting-api.onrender.com
```

The result is `18roots-doctor-test.apk`.

Install each APK on a different Android phone. Share them by Google Drive or similar, and allow "install unknown apps" when asked.

## Step 9: hold a real call

**Phone 1, the patient:**

1. Open **18Roots** and sign in with **98765 43210**. The code is **123456**, and the screen shows it.
2. Go to **Consult**, then **Book a consultation**, then **Dr. Meera Krishnan**.
3. Pick any time, tick the consent box, then tap **Pay**. It's a demo payment.
4. On the confirmation screen, tap **Join Consultation**, then **Join now**.
5. While it waits, the call screen shows **Meeting ID for the doctor**. Press and hold the ID to copy it, then send it to phone 2, for example on WhatsApp.

**Phone 2, the doctor:**

1. Open **18Roots Meeting Test** and choose **Doctor**.
2. Paste the meeting ID under **Join an existing meeting**, then tap **Join as selected role**.

Both phones should now see and hear each other. Then try:
- **Mute** and **Camera off**.
- **Different networks:** move one phone to mobile data.
- **Leave** on the patient phone.
- **End meeting** on the doctor phone.

On the patient phone, the consultation then shows as **Completed**. A consultation the doctor never joins shows as **Missed**.

## When something goes wrong

| What you see | Likely cause | What to do |
| --- | --- | --- |
| A page or the app takes a minute, then works | The free service was asleep | Normal on the free plan |
| `/health/ready` never loads, and the service logs say `Missing production environment variables` | A Step 5 value is empty | Fill it in under **Environment**, then save |
| The logs say `JWT_PRIVATE_KEY is not a readable PEM private key` | The value was cut or has extra spaces | Paste the whole line again from `secrets.local.txt` |
| Join says it could not connect, and the meeting service logs show 401 | The public key doesn't match the private key | Paste both keys again from the same `secrets.local.txt` |
| A consultation never shows "In progress" | Meeting events aren't arriving | Check `EVENTS_WEBHOOK_URL` and that the two event secrets are identical |
| The call connects but shows no video | Wrong LiveKit URL | `LIVEKIT_PUBLIC_URL` must start with `wss://`; check the LiveKit key and secret |
| The doctor app says "meeting is not ready to join" | The patient hasn't joined yet | The patient taps **Join now** first, then the doctor joins |
| An APK build fails on downloads | Flaky network | Run the same command again; it retries and uses IPv4 |
| Everything is empty after about a month | The free database expired | Delete and recreate `roots18-db` in Render; demo data reloads on the next start |

To read a service's logs, open it in Render and click **Logs**.

## Updating after code changes

```bash
bash render-deploy/prepare-repo.sh
```

```bash
cd ~/18roots-platform && git push
```

Render rebuilds only the service whose folder changed. Rebuild the APKs only when the app changes or the addresses change.

## Before real patients

1. **Remove the test settings** from `roots18-main-backend`:
   - `DEMO_PAYMENTS` and `ALLOW_DEMO_PAYMENTS_IN_PRODUCTION`
   - `OTP_FIXED_CODE` and `ALLOW_TEST_LOGIN_IN_PRODUCTION`
   - `SEED_DEMO_DATA`
   - `JOIN_OPENS_MINUTES_BEFORE`

   Rebuild the patient app without `EXPO_PUBLIC_SHOW_MEETING_ID`.
2. **Connect the real services:**
   - a real SMS provider for login codes
   - the payment service (Phase 2b)
   - the doctor portal, which will replace the doctor test app
3. **Move to paid plans** with database backups. The free database is deleted after 30 days.
4. **Run the checks** from `meeting-service/docs/ROADMAP.md`: a load test, a security review and a legal review.
