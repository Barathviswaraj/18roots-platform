# Deploy 18Roots to Render through Docker Hub (no GitHub needed)

At the end you'll have:
- **The main backend and the meeting service** running on Render's free plan.
- **Video calls** running on LiveKit Cloud.
- **Two Android apps:**
  - the patient app (`18roots-app-render.apk`)
  - a doctor test app (`18roots-doctor-test.apk`), so two phones can hold a real call from different places

**How it works:** this laptop packs each backend into a Docker image and uploads both images to one private repository on Docker Hub. Render downloads them from there and runs them. You create the four Render parts by hand.

The steps take about an hour, plus upload time. The first upload sends a few hundred megabytes; later uploads send only what changed. Run every command from the project folder:

```bash
cd /home/vakilsearch/.codex/.chatgpt-projects/g-p-6ad31df6ca80819181510ddf2f4d548d
```

If you make a GitHub account later, `DEPLOY-GITHUB.md` describes the other way: Render builds straight from the code.

## What this setup is (and isn't)

- **Four parts on Render:** two web services, one PostgreSQL database and one Key Value store (the job queue).
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
  - **Docker Hub:** the free plan includes one private repository. Both images go into it.
  - **LiveKit Cloud's free plan** allows about 5,000 participant minutes a month.
- **What's been tested:**
  - On this laptop, this exact setup ran in production mode with one shared database and one shared store, and 30 of 30 checks passed.
  - Both helper scripts were tested.
  - **Not yet tried:** building the Docker images, because Docker needs your password on this laptop. Render itself hasn't been tried either.

## Step 1: create the accounts

1. **Docker Hub:** <https://hub.docker.com/signup>. The free Personal plan is enough. Your **Docker ID** is your user name, in lowercase letters and numbers. You'll type it in commands below.
2. **Render:** <https://dashboard.render.com/register>. Sign up with your email; no GitHub is needed.
3. **LiveKit Cloud:** <https://cloud.livekit.io>. A free account is enough.

## Step 2: set up Docker Hub

1. **Create the private repository.**
   1. On Docker Hub, open **My Hub**, then **Repositories**, then **Create repository**.
   2. Repository name: `roots18`.
   3. Visibility: **Private**. This matters: anyone can download a public repository, including your code.
   4. Click **Create**.
2. **Make two access tokens.** These work like passwords for programs, and you can delete them at any time.
   1. Click your avatar at the top right, then **Account settings**, then **Personal access tokens**, then **Generate new token**.
   2. Make these two:

      | Description | Access permissions | Used for |
      | --- | --- | --- |
      | `laptop-push` | **Read & Write** | Uploading images from this laptop (Step 5) |
      | `render-pull` | **Read-only** | Render downloading the images (Steps 8 and 9) |

   3. Copy each token as soon as it appears; Docker Hub shows it only once. Keep both in a password manager or a private note. Never paste them into chat.

## Step 3: make the secrets (on this laptop)

```bash
node render-deploy/make-secrets.js
```

This creates two private files:

| File | What it holds |
| --- | --- |
| `render-deploy/secrets.local.txt` | The login key pair and the shared events secret. Step 7 reads them for you. |
| `render-deploy/jwt-private.pem` | The backend's private key, used later to make the doctor test login |

Never send these files or their contents by chat or email.

## Step 4: set up LiveKit Cloud

1. In LiveKit Cloud, create a project. Any name works, for example `18roots-test`.
2. Open **Settings**, then **API Keys**, and create a key. Copy the **API key** and the **API secret**. The secret is shown only once.
3. Note your project URL. It looks like `wss://18roots-test-abc123.livekit.cloud`.

You'll paste these three values in Step 7.

## Step 5: build and upload the images

Replace `YOUR-DOCKER-ID` with your Docker ID:

```bash
bash render-deploy/push-images.sh YOUR-DOCKER-ID
```

What happens:
1. **Laptop password:** `sudo` asks for it, because Docker needs administrator rights on this laptop.
2. **Private check:** the script checks that `roots18` isn't public. It then asks whether you created it as Private. Type `yes`.
3. **Docker Hub sign-in:** Docker asks for a password. Paste the `laptop-push` token and press Enter. Nothing shows while you paste. You should see `Login Succeeded`.
4. **Build and upload:** it builds both images (5 to 15 minutes the first time) and uploads them.

At the end it prints the two image addresses:

```text
docker.io/YOUR-DOCKER-ID/roots18:meeting
docker.io/YOUR-DOCKER-ID/roots18:backend
```

If the network drops, run the same command again. Docker reuses the parts it already finished.

## Step 6: create the database and the store on Render

Choose **Singapore** for all four Render parts. Parts in different regions can't reach each other's internal addresses.

**The database:**
1. In the Render dashboard, click **New**, then **Postgres**.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | Name | `roots18-db` |
   | Database | `roots18` |
   | User | `roots18` |
   | Region | **Singapore** |
   | PostgreSQL version | Leave as it is |
   | Plan | **Free** |

3. Click **Create Database** and wait until it shows **Available**.
4. Click **Connect** at the top right and open the **Internal** tab. Copy the **Internal Database URL**.
   - It starts with `postgresql://`.
   - Its host has no dots, for example `dpg-abc123-a`.

**The store (Key Value):**
1. Click **New**, then **Key Value**.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | Name | `roots18-queue` |
   | Region | **Singapore** |
   | Maxmemory Policy | **noeviction**, so queued jobs are never dropped |
   | Plan | **Free** |

3. Click **Create**. Then click **Connect**, open **Internal**, and copy the internal URL. It looks like `redis://red-abc123:6379`.

## Step 7: write the Render settings files (on this laptop)

```bash
node render-deploy/make-env-files.js
```

It asks seven questions. Paste each answer and press Enter:

| Question | Answer |
| --- | --- |
| Render database, Internal Database URL | From Step 6 |
| Render Key Value, Internal URL | From Step 6 |
| LiveKit project URL | From Step 4, starting `wss://` |
| LiveKit API key | From Step 4 |
| LiveKit API secret | From Step 4 |
| Meeting service address | Press Enter |
| Main backend address | Press Enter |

It writes two files. Each holds every setting one service needs, including the keys from Step 3:

| File | For the Render service |
| --- | --- |
| `render-deploy/meeting-api.env` | `roots18-meeting-api` (19 settings) |
| `render-deploy/main-backend.env` | `roots18-main-backend` (18 settings) |

Both files hold secrets. Open them only on this laptop.

## Step 8: create the meeting service on Render

1. Click **New**, then **Web Service**.
2. Under the source, choose **Existing Image**. In **Image URL**, enter `docker.io/YOUR-DOCKER-ID/roots18:meeting`.
3. Add the credential, so Render can read your private repository:
   1. Click **Add credential**.
   2. Fill in:

      | Field | Value |
      | --- | --- |
      | Name | `dockerhub` |
      | Registry | **Docker Hub** |
      | Username | Your Docker ID |
      | Personal Access Token | The `render-pull` token |

   3. Save it and choose it.
4. Click **Connect**. If Render can't reach the image, check the image address and the token.
5. Fill in the service:

   | Field | Value |
   | --- | --- |
   | Name | `roots18-meeting-api`. The name becomes the address: `https://roots18-meeting-api.onrender.com`. |
   | Region | **Singapore** |
   | Instance type | **Free** |

6. **Environment Variables:**
   1. Open the settings file in the text editor:

      ```bash
      gnome-text-editor render-deploy/meeting-api.env
      ```

   2. In the editor, select all (Ctrl+A) and copy (Ctrl+C).
   3. In Render, click **Add from .env**, paste, and confirm. Render should list 19 variables.
7. Open **Advanced**:
   - **Health Check Path:** `/health/ready`.
   - **Docker Command:** leave it empty. The image already starts itself the right way: it prepares the database, then starts the job worker and the web server.
8. Click **Deploy Web Service**. The first start takes a few minutes.

If the form has no **Add from .env** button, create the service anyway. Then open its **Environment** page, use **Add from .env** there, and click **Save changes**. The first start fails until the settings are in; that's expected.

## Step 9: create the main backend on Render

Repeat Step 8 with these changes:

| Field | Value |
| --- | --- |
| Image URL | `docker.io/YOUR-DOCKER-ID/roots18:backend` |
| Credential | Choose `dockerhub`; it's already saved |
| Name | `roots18-main-backend` |
| Settings file | `gnome-text-editor render-deploy/main-backend.env`. Render should list 18 variables. |

Everything else stays the same: Singapore, Free, health check path `/health/ready`, and an empty Docker Command.

The first start also loads the demo doctors and the demo patient.

## Step 10: confirm the addresses

1. Open each service in the Render dashboard. Its address is at the top.
2. If Render added letters to either name, for example `roots18-main-backend-x7k2.onrender.com`, change the one setting that points at it. Open the other service's **Environment** page, edit the setting, and click **Save changes**:

   | If this address changed | Open | Set |
   | --- | --- | --- |
   | Main backend | `roots18-meeting-api` | `EVENTS_WEBHOOK_URL` = `https://<real backend address>/webhooks/meetings` |
   | Meeting service | `roots18-main-backend` | `MEETING_SERVICE_URL` = `https://<real meeting address>` |

   To keep your files matching, run Step 7 again. Type the real address, and press Enter for everything else.
3. Open these three pages in a browser. The first visit can take a minute while a service wakes up.

   | Page | You should see |
   | --- | --- |
   | `https://<backend>/health/ready` | `{"status":"ready"}` |
   | `https://<meeting>/health/ready` | `{"status":"ready"}` |
   | `https://<backend>/.well-known/jwks.json` | A key starting `{"keys":[{"kty":"RSA"` |

## Step 11: connect LiveKit's webhook

1. In LiveKit Cloud, open **Settings**, then **Webhooks**, and add a webhook.
2. URL: `https://<meeting>/api/v1/livekit/webhook`.
3. Signing key: the same API key you gave in Step 7.

## Step 12: build the two APKs (on this laptop)

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

## Step 13: hold a real call

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

**Uploading the images (Step 5):**

| What you see | Likely cause | What to do |
| --- | --- | --- |
| `Docker is not running` | The Docker service is stopped | Run `sudo systemctl start docker`, then try again |
| `unauthorized: incorrect username or password` | Wrong Docker ID or token | Check the Docker ID; paste the `laptop-push` token again |
| `denied: requested access to the resource is denied` | The token can't write, or the Docker ID is wrong | Make a **Read & Write** token and run the script again |
| `Docker Hub says ... is PUBLIC` | The repository was created as public | On Docker Hub, open `roots18`, then **Settings**, and make it **Private** |
| A build stops on a download | Flaky network | Run the same command again |

**Starting on Render (Steps 8 to 10):**

| What you see | Likely cause | What to do |
| --- | --- | --- |
| Render can't pull the image (`unauthorized` or `not found`) | Wrong image address or credential | Check the service's **Settings**, under **Image**: the address and the `dockerhub` credential with the `render-pull` token |
| `exec format error` in the logs | The image was built for another kind of computer | Build with the script on this laptop; it builds for Render's kind (`linux/amd64`) |
| `/health/ready` never loads, and the logs say `Missing production environment variables` | Settings weren't added | Add the settings file on the **Environment** page and save |
| The logs say `JWT_PRIVATE_KEY is not a readable PEM private key` | The value was cut | Paste the whole settings file again with **Add from .env** |
| The logs say `relation ... does not exist` | The database wasn't prepared | Clear the **Docker Command** in **Settings**, so the image's own start command runs |
| A page or the app takes a minute, then works | The free service was asleep | Normal on the free plan |
| Everything is empty after about a month | The free database expired | Delete and recreate `roots18-db`. Run Step 7 again with its new Internal URL, and update `DATABASE_URL` on both services. Demo data reloads on the next start. |

**During a call (Step 13):**

| What you see | Likely cause | What to do |
| --- | --- | --- |
| Join says it could not connect, and the meeting service logs show 401 | The two keys don't match | Run Step 7 again and paste both settings files again |
| A consultation never shows "In progress" | Meeting events aren't arriving | Check `EVENTS_WEBHOOK_URL` (Step 10) |
| The call connects but shows no video | Wrong LiveKit details | Check the LiveKit URL, key and secret; run Step 7 again if needed |
| The doctor app says "meeting is not ready to join" | The patient hasn't joined yet | The patient taps **Join now** first, then the doctor joins |
| An APK build fails on downloads | Flaky network | Run the same command again; it retries and uses IPv4 |

To read a service's logs, open it in Render and click **Logs**.

## Updating after code changes

1. Build and upload only the service you changed (`backend` or `meeting`; leave it off for both):

   ```bash
   bash render-deploy/push-images.sh YOUR-DOCKER-ID backend
   ```

2. In Render, open that service and click **Manual Deploy**, then **Deploy latest reference**. Render doesn't pick up new images by itself.

**Going back to an older build:** each upload is also saved with its date, for example `backend-20261111-1530`. Docker Hub lists them under the repository's **Tags**. In Render, open the service's **Settings**, change the image address to that tag, save, and deploy.

**Changing a setting:** edit it on the service's **Environment** page in Render and click **Save changes**. Render restarts the service.

Rebuild the APKs only when the app changes or the addresses change.

## Before real patients

1. **Remove the test settings** from `roots18-main-backend`, on its **Environment** page:
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
