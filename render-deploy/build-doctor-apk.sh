#!/usr/bin/env bash
# Builds the meeting test app as the demo doctor, for a real two-phone call.
#   bash render-deploy/build-doctor-apk.sh https://MAIN-BACKEND.onrender.com https://MEETING-API.onrender.com
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BACKEND=${1%/}
MEETINGS=${2%/}
for url in "$BACKEND" "$MEETINGS"; do
  [[ "$url" == https://* ]] || { echo "Both addresses must start with https://" >&2; exit 1; }
done

TOKEN=$(node "$ROOT/render-deploy/doctor-token.js" "$BACKEND")
# EXPO_PUBLIC_LIVEKIT_URL stays blank: the app uses the address the meeting service returns.
(umask 077; cat > "$ROOT/meeting-service/mobile/.env.production" <<ENV
EXPO_PUBLIC_API_URL=$MEETINGS
EXPO_PUBLIC_LIVEKIT_URL=
EXPO_PUBLIC_TEST_DOCTOR_TOKEN=$TOKEN
EXPO_PUBLIC_TEST_PATIENT_TOKEN=
ENV
)
echo "Wrote meeting-service/mobile/.env.production for the demo doctor (token valid 14 days)"

[ "${NO_BUILD:-0}" = "1" ] && exit 0
(cd "$ROOT/meeting-service/mobile" && bash scripts/build-hosted-apk.sh)
cp "$ROOT/meeting-service/mobile/android/app/build/outputs/apk/release/app-release.apk" "$ROOT/18roots-doctor-test.apk"
echo "Doctor APK: $ROOT/18roots-doctor-test.apk"
