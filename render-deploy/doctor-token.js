#!/usr/bin/env node
// Makes a 14-day login token for the demo doctor (Dr. Meera Krishnan), signed
// with the backend's private key, so the meeting test app can join calls as
// that doctor until the doctor portal exists. Testing only.
//   node render-deploy/doctor-token.js https://MAIN-BACKEND.onrender.com
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const backend = (process.argv[2] || "").replace(/\/+$/, "");
if (!backend.startsWith("https://") && !backend.startsWith("http://localhost")) {
  console.error("Give the main backend address, for example https://roots18-main-backend.onrender.com");
  process.exit(1);
}
const keyFile = path.join(__dirname, "jwt-private.pem");
if (!fs.existsSync(keyFile)) {
  console.error("render-deploy/jwt-private.pem is missing. Run: node render-deploy/make-secrets.js");
  process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(pathname, { method = "GET", body, token } = {}, attempt = 1) {
  const response = await fetch(`${backend}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  // A code was sent to this number in the last 30 seconds (for example from
  // the app): wait it out once, then ask again.
  if (response.status === 429 && attempt === 1) {
    console.error("Waiting 31 seconds for the login code limit...");
    await wait(31_000);
    return call(pathname, { method, body, token }, 2);
  }
  if (!response.ok) throw new Error(`${method} ${pathname} answered ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  // Look up the doctor's ID through the API, signed in as the demo patient.
  const phone = "+919876543210";
  const otp = await call("/v1/auth/otp", { method: "POST", body: { phone } });
  if (!otp.demoCode) throw new Error("The backend has no OTP_FIXED_CODE; this script needs the test login.");
  const session = await call("/v1/auth/verify", { method: "POST", body: { requestId: otp.requestId, phone, code: otp.demoCode } });
  const { doctors } = await call("/v1/doctors?query=Meera", { token: session.accessToken });
  const doctor = doctors.find((item) => item.name === "Dr. Meera Krishnan");
  if (!doctor) throw new Error("Dr. Meera Krishnan was not found. Is SEED_DEMO_DATA=true on the backend?");

  // The meeting service knows a doctor without a portal login as "doctor-<id>".
  const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = base64url({ alg: "RS256", typ: "JWT" });
  const payload = base64url({
    iss: "18roots-main-app",
    aud: "18roots-meeting-service",
    sub: `doctor-${doctor.id}`,
    role: "doctor",
    exp: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
  });
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), fs.readFileSync(keyFile, "utf8"));
  process.stdout.write(`${header}.${payload}.${signature.toString("base64url")}\n`);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
