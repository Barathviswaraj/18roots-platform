#!/usr/bin/env node
// Writes mobile/.env.production so a release APK talks to the hosted API.
//
//   node scripts/make-hosted-env.js                    creates the shared secret only
//   node scripts/make-hosted-env.js https://api.host   also writes the APK settings
//
// The secret lives in meeting-service/.hosted-test-secret and must match
// PLATFORM_JWT_SECRET on the server. The tokens let the APK act as the two fixed test
// users. Anyone holding the APK holds them, so they expire and this is for testing only.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TOKEN_LIFETIME_DAYS = 14;
const ISSUER = "18roots-main-app";
const AUDIENCE = "18roots-meeting-service";

const mobileDir = path.join(__dirname, "..");
const secretFile = path.join(mobileDir, "..", ".hosted-test-secret");

if (!fs.existsSync(secretFile)) {
  fs.writeFileSync(secretFile, `${crypto.randomBytes(48).toString("hex")}\n`, { mode: 0o600 });
  console.log(`Created ${secretFile}`);
}
const secret = fs.readFileSync(secretFile, "utf8").trim();

const apiUrl = (process.argv[2] || "").replace(/\/+$/, "");
if (!apiUrl) {
  console.log("Secret is ready. Run again with your https API address to write the APK settings.");
  process.exit(0);
}
if (!apiUrl.startsWith("https://")) {
  console.error("The API address must start with https://");
  process.exit(1);
}

const base64url = (value) => Buffer.from(value).toString("base64url");

function signToken(role) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: `local-${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
  }));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

// EXPO_PUBLIC_LIVEKIT_URL is deliberately blank: the app then uses the address the API returns.
fs.writeFileSync(path.join(mobileDir, ".env.production"), [
  `EXPO_PUBLIC_API_URL=${apiUrl}`,
  "EXPO_PUBLIC_LIVEKIT_URL=",
  `EXPO_PUBLIC_TEST_DOCTOR_TOKEN=${signToken("doctor")}`,
  `EXPO_PUBLIC_TEST_PATIENT_TOKEN=${signToken("patient")}`,
  "",
].join("\n"), { mode: 0o600 });
console.log(`Wrote mobile/.env.production for ${apiUrl}. Tokens last ${TOKEN_LIFETIME_DAYS} days.`);
