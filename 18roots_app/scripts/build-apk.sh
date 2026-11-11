#!/usr/bin/env bash
# Builds a release APK on this computer for testing. It is signed with the
# debug key, so it installs on phones but cannot go to the Play Store; use
# `eas build` for store builds. Settings come from .env (see .env.example).
set -euo pipefail
cd "$(dirname "$0")/.."

# The native build needs JDK 17. Use APK_JAVA_HOME, then Gradle's own copy, then JAVA_HOME.
GRADLE_JDK17="$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2"
if [ -n "${APK_JAVA_HOME:-}" ]; then
  export JAVA_HOME="$APK_JAVA_HOME"
elif [ -d "$GRADLE_JDK17" ]; then
  export JAVA_HOME="$GRADLE_JDK17"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
# Some networks advertise IPv6 but cannot route it; Java then fails to download
# Android libraries where curl falls back to IPv4. IPv4 works everywhere here.
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Djava.net.preferIPv4Stack=true"
"$JAVA_HOME/bin/java" -version 2>&1 | head -1

[ -d node_modules ] || npm ci --no-audit --no-fund
# Applies app.config.ts to the native project (creates android/ the first time).
npx expo prebuild --platform android --no-install

# --rerun on the bundle task only: the JavaScript bundle reads .env, which
# Gradle does not track. Native code is rebuilt only when it changes.
# Phone CPUs only (ARM); x86 is for emulators and would double the size.
# Retries with backoff and fewer parallel workers ride out flaky connections
# while Gradle downloads Android libraries on the first build.
(cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun assembleRelease -x lint \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  --max-workers=4 \
  -Dorg.gradle.internal.repository.max.retries=8 \
  -Dorg.gradle.internal.repository.initial.backoff=2000 \
  -Dorg.gradle.internal.http.connectionTimeout=60000 \
  -Dorg.gradle.internal.http.socketTimeout=120000)
echo "APK ready: $(pwd)/android/app/build/outputs/apk/release/app-release.apk"
