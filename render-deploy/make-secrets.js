#!/usr/bin/env node
// Creates the values both services must share, on your computer only:
//   - an RS256 key pair: the main backend signs login tokens with the private
//     key; the meeting service checks them with the public key.
//   - one random secret that signs the meeting service's events.
// Writes render-deploy/secrets.local.txt (values to paste into Render) and
// render-deploy/jwt-private.pem (used to make the doctor test token). Both are
// ignored by Git. Never send them by chat or email.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const txt = path.join(dir, "secrets.local.txt");
const pem = path.join(dir, "jwt-private.pem");

if (fs.existsSync(txt) && !process.argv.includes("--replace")) {
  console.log(`${txt} already exists. Keeping it (run with --replace to make new values).`);
  process.exit(0);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const eventsSecret = crypto.randomBytes(32).toString("hex");
// Render's value field takes one line; both services turn "\n" back into line breaks.
const oneLine = (value) => value.trim().replace(/\n/g, "\\n");

fs.writeFileSync(pem, privateKey, { mode: 0o600 });
fs.writeFileSync(
  txt,
  [
    "# Paste each value into Render when the Blueprint asks for it. Keep this file private.",
    "",
    "## roots18-main-backend",
    `JWT_PRIVATE_KEY=${oneLine(privateKey)}`,
    `MEETING_EVENTS_SECRET=${eventsSecret}`,
    "",
    "## roots18-meeting-api",
    `PLATFORM_JWT_PUBLIC_KEY=${oneLine(publicKey)}`,
    `EVENTS_WEBHOOK_SECRET=${eventsSecret}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log(`Wrote ${txt} and ${pem}. Open the text file to copy the values; do not share them.`);
