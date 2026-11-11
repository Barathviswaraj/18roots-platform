#!/usr/bin/env bash
# Builds the release APK from mobile/.env.production.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.production ] || { echo "mobile/.env.production is missing. Run: node scripts/make-hosted-env.js https://YOUR-API-ADDRESS" >&2; exit 1; }

# The native build needs JDK 17. If Gradle's own copy is not here, JAVA_HOME must point to one.
GRADLE_JDK17="$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2"
if [ -n "${HOSTED_APK_JAVA_HOME:-}" ]; then
  export JAVA_HOME="$HOSTED_APK_JAVA_HOME"
elif [ -d "$GRADLE_JDK17" ]; then
  export JAVA_HOME="$GRADLE_JDK17"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

# Both of these are generated, so a fresh copy of the project does not have them.
[ -d node_modules ] || npm ci
[ -d android ] || npx expo prebuild --platform android --no-install

# --rerun is required: Gradle does not notice changes to .env.production, so
# without it the APK can keep the previous server address.
(cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --console=plain --quiet)

echo "APK ready: $PWD/android/app/build/outputs/apk/release/app-release.apk"
