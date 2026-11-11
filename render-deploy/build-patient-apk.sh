#!/usr/bin/env bash
# Builds the patient app APK for the Render servers.
#   bash render-deploy/build-patient-apk.sh https://MAIN-BACKEND.onrender.com https://MEETING-API.onrender.com
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BACKEND=${1%/}
MEETINGS=${2%/}
for url in "$BACKEND" "$MEETINGS"; do
  [[ "$url" == https://* ]] || { echo "Both addresses must start with https://" >&2; exit 1; }
done

curl -fsS --max-time 120 "$BACKEND/health/ready" >/dev/null || { echo "The main backend is not ready at $BACKEND (it may be waking up; try again in a minute)." >&2; exit 1; }

cat > "$ROOT/18roots_app/.env" <<ENV
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_API_URL=$BACKEND
EXPO_PUBLIC_MEETING_API_URL=$MEETINGS
EXPO_PUBLIC_SHOW_MEETING_ID=true
ENV
echo "Wrote 18roots_app/.env for $BACKEND"

[ "${NO_BUILD:-0}" = "1" ] && exit 0
(cd "$ROOT/18roots_app" && bash scripts/build-apk.sh)
cp "$ROOT/18roots_app/android/app/build/outputs/apk/release/app-release.apk" "$ROOT/18roots-app-render.apk"
echo "Patient APK: $ROOT/18roots-app-render.apk"
