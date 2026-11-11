# 18Roots patient app

The 18Roots mobile app for Android and iOS: Siddha care for women's wellness. It is part of Phase 2 in [../meeting-service/docs/ROADMAP.md](../meeting-service/docs/ROADMAP.md).

The app runs in two modes:

- **Demo mode** (the default) uses a built-in backend, so every screen works with no server. Sign in with any Indian mobile number and the code `123456`.
- **Live mode** talks to the main backend (`../main-backend`) and the Phase 1 meeting service.

## Screens

| Tab | What it does |
| --- | --- |
| Home | Greeting, care-journey progress, next consultation with Join, today's medicine reminder, order tracking. Sections come from the backend and render in the order it sends. |
| Care | Plan progress, today's doses by time of day, lifestyle goals, a 7-day adherence chart, notes from the doctor |
| Consult | Book a consultation, upcoming and past consultations |
| Orders | Medicine orders with filters and delivery progress |
| Profile | Personal details, language (English or Tamil), reminders, help, sign out |

Other screens:

- **Sign-in:** phone number, then a one-time code.
- **Booking:** choose a doctor, then a time, then review the fee and cancellation policy, pay, and see a confirmation.
- **Details:** consultation details with cancel, order details with a delivery timeline, notifications, and edit profile.
- **Video call:** a pre-join check, then the LiveKit call.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | React Native 0.86, Expo SDK 57, TypeScript |
| Navigation | Expo Router: file-based, with protected routes for signed-in screens |
| API | Axios, with token refresh and runtime response checks using Zod |
| Server state | TanStack Query: caching, retries with backoff, instant updates that roll back on failure, offline awareness |
| Local state | Zustand: session, language, reminders, toasts |
| Forms | React Hook Form and Zod |
| UI | React Native Paper (inputs, dialogs, snackbar) and StyleSheet, with SVG illustrations |
| Video | LiveKit React Native SDK, joining rooms from the meeting service |
| Secure storage | Expo SecureStore: Keychain on iOS, Keystore-backed storage on Android |
| Notifications | Expo Notifications: discreet local reminders |
| Build | EAS Build profiles for development, preview APK and production AAB/IPA |

## Folder layout

```
app/                    Screens (Expo Router)
  (auth)/               Sign-in and code entry
  (app)/(tabs)/         Home, Care, Consult, Orders, Profile
  (app)/doctors/        Doctor list and profile with time slots
  (app)/booking/        Review and pay, confirmation
  (app)/call/[id].tsx   Pre-join check and video call
src/api/                Axios client, schemas (the backend contract), endpoints, query hooks, meeting-service client
src/api/mock/           Built-in demo backend
src/components/         Cards, buttons, tab bar, illustrations, progress ring, order stepper, states
src/features/           Home sections, booking and payment, call room
src/i18n/               English and Tamil strings
src/store/              Session and preferences
src/lib/                Settings, formatting, form rules, reminders, secure storage
__tests__/              Unit tests for the demo backend, form rules, translations and timing
```

## Run it

You need Node.js 22, and either Android Studio with the Android SDK and JDK 17, or Xcode on a Mac. LiveKit needs native code, so Expo Go cannot run this app. Use a development build.

```bash
npm ci
cp .env.example .env
npx expo run:android      # or: npx expo run:ios
```

After the first build, `npm start` reloads JavaScript changes on the installed app.

To preview the screens in a browser without a phone, run `npm run web`. Video calls and reminders only work in the mobile app. Check Tamil text on a phone: some desktop browsers lack Tamil fonts and show boxes, while Android and iOS include them.

## Live mode

Set these in `.env`, or in `eas.json` for cloud builds:

```
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_API_URL=https://your-main-backend
EXPO_PUBLIC_MEETING_API_URL=https://your-meeting-service
```

The main backend in `../main-backend` implements this contract. Its specs save real responses, and `__tests__/backendContract.test.ts` checks them against `src/api/schemas.ts` whenever both folders sit side by side.

**Endpoints:**
- `/v1/auth/otp`, `/v1/auth/verify`, `/v1/auth/refresh`, `/v1/auth/logout`
- `/v1/me`, `/v1/home`, `/v1/care-plan`, `/v1/doctors`
- `/v1/consultations`, `/v1/bookings`, `/v1/orders`, `/v1/notifications`

`src/api/mock/server.ts` is a working reference for each one.

**Login tokens** must be accepted by the meeting service. Use the same issuer, and include the meeting service in the audience.

## Try a real call in demo mode

1. Start the meeting service locally in development mode (`meeting-service/README.md`), with `MEETING_CREATOR_ROLES=service,doctor` and `CORS_ORIGINS` including the app's address if you use the web preview.
2. Set `EXPO_PUBLIC_MEETING_API_URL=http://YOUR-COMPUTER-IP:3000` and rebuild or restart the app.
3. In this app, open the upcoming consultation and tap **Join**, then **Join now**. The app creates a meeting, prepares the room and fetches a join token, and the call screen shows a meeting ID while it waits.
4. On a second phone, open the meeting test app, choose **Doctor**, paste the meeting ID and tap **Join as selected role**.

## Build for release

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview      # APK to install directly
eas build --platform all --profile production       # Play Store AAB and App Store build
```

- Set the real API addresses in `eas.json` first.
- EAS creates and keeps the Android keystore and iOS certificates.
- iOS needs an Apple Developer account.
- To build an APK on your own computer instead, run `npm run build:apk` (JDK 17 and the Android SDK needed). It uses the debug key, so it's for testing only.
- After changing `app.config.ts` or adding a native package, delete the `android/` folder so the next build regenerates it.

## Checks

```bash
npm run typecheck
npm test
npx expo export --platform android --platform ios   # makes sure both bundles build
npm run assets                                       # redraws the icons from scripts/make-assets.py
```

## Built in for reliability

- **Response checks:** every response is checked against a schema, and a mismatch shows an error screen instead of crashing.
- **Retries and token refresh:** network errors retry with backoff, while 4xx answers don't. An expired session refreshes once, shared by all waiting requests, then signs out if the refresh fails.
- **Offline:** cached data stays on screen, a banner shows, and data refreshes when the phone reconnects or the app returns to the foreground.
- **Instant updates:** marking a dose or goal updates the screen immediately and rolls back if the server refuses.
- **Bookings:**
  - Each attempt uses one idempotency key, so a double tap or retry can't create a second booking or charge.
  - The Pay button locks while a payment is in progress.
- **Discreet reminders:** they never name a medicine or condition, and Android hides their content on the lock screen.
- **Errors and forward compatibility:** every screen has loading, empty and error states, and a route-level error boundary catches anything else. The home screen skips section types it doesn't know, so older app versions keep working.

## Before release

- [x] Main backend built to this contract (`../main-backend`), and its responses checked against the app's schemas
- [ ] Live mode tested on a phone against a hosted backend
- [ ] Payment provider connected. The app supports a hosted checkout link and polls for confirmation; a native Razorpay SDK can replace this in `src/features/booking/payment.ts`.
- [ ] Tamil text reviewed by a native speaker with healthcare experience
- [ ] Push notifications from the backend (needs an EAS project ID and Firebase Cloud Messaging for Android)
- [ ] Crash reporting, such as Sentry or GlitchTip
- [ ] Real doctor photos and the final app icon from the designer
- [ ] Accessibility check with TalkBack and VoiceOver
- [ ] Tested on low-end Android phones and slow networks
- [ ] Privacy policy and terms pages, and the store listings
