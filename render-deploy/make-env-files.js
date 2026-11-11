#!/usr/bin/env node
// Writes every Render setting for the two services as two files, ready for
// the "Add from .env" button on Render:
//   render-deploy/meeting-api.env    for roots18-meeting-api
//   render-deploy/main-backend.env   for roots18-main-backend
// It asks for the values that come from Render and LiveKit. The key pair and
// the shared secret come from secrets.local.txt (run make-secrets.js first).
// Both files hold secrets: keep them on this laptop and never share them.
//   node render-deploy/make-env-files.js
// Run it again to change an answer; press Enter to keep the others.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const dir = __dirname;
const secretsFile = path.join(dir, "secrets.local.txt");
const meetingFile = path.join(dir, "meeting-api.env");
const backendFile = path.join(dir, "main-backend.env");

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
}

const secrets = readEnvFile(secretsFile);
for (const name of ["JWT_PRIVATE_KEY", "PLATFORM_JWT_PUBLIC_KEY", "MEETING_EVENTS_SECRET"]) {
  if (!secrets[name]) {
    console.error("render-deploy/secrets.local.txt is missing or incomplete. Run: node render-deploy/make-secrets.js");
    process.exit(1);
  }
}
const oldMeeting = readEnvFile(meetingFile);
const oldBackend = readEnvFile(backendFile);

const hostHasDomain = (value) => {
  try {
    return new URL(value).hostname.includes(".");
  } catch {
    return false;
  }
};
const address = (value) => value.replace(/\/+$/, "");

const questions = [
  {
    key: "databaseUrl",
    label: "Render database, Internal Database URL",
    current: oldBackend.DATABASE_URL,
    secret: true,
    check: (v) => /^postgres(ql)?:\/\/\S+$/.test(v) || "It should start with postgresql://",
    warn: (v) =>
      hostHasDomain(v) &&
      "This looks like the External URL. Use the Internal one if you can: its host looks like dpg-xxxx-a, with no dots.",
  },
  {
    key: "redisUrl",
    label: "Render Key Value, Internal URL",
    current: oldBackend.REDIS_URL,
    secret: true,
    check: (v) => /^rediss?:\/\/\S+$/.test(v) || "It should start with redis://",
    warn: (v) =>
      hostHasDomain(v) &&
      "This looks like the External URL, which Render blocks by default. Use the Internal one: redis://red-xxxx:6379",
  },
  {
    key: "livekitUrl",
    label: "LiveKit project URL (wss://...livekit.cloud)",
    current: oldMeeting.LIVEKIT_PUBLIC_URL,
    clean: (v) => address(v).replace(/^https:\/\//, "wss://"),
    check: (v) => /^wss:\/\/[^\s/]+$/.test(v) || "It should look like wss://your-project.livekit.cloud",
  },
  {
    key: "livekitKey",
    label: "LiveKit API key",
    current: oldMeeting.LIVEKIT_API_KEY,
    check: (v) => /^\S+$/.test(v) || "Paste the key without spaces",
  },
  {
    key: "livekitSecret",
    label: "LiveKit API secret",
    current: oldMeeting.LIVEKIT_API_SECRET,
    secret: true,
    check: (v) => /^\S+$/.test(v) || "Paste the secret without spaces",
  },
  {
    key: "meetingUrl",
    label: "Meeting service address",
    current: oldBackend.MEETING_SERVICE_URL || "https://roots18-meeting-api.onrender.com",
    clean: address,
    check: (v) => /^https:\/\/[^\s/]+$/.test(v) || "It should look like https://roots18-meeting-api.onrender.com",
  },
  {
    key: "backendUrl",
    label: "Main backend address",
    current: (oldMeeting.EVENTS_WEBHOOK_URL || "").replace(/\/webhooks\/meetings$/, "") ||
      "https://roots18-main-backend.onrender.com",
    clean: address,
    check: (v) => /^https:\/\/[^\s/]+$/.test(v) || "It should look like https://roots18-main-backend.onrender.com",
  },
];

async function ask() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  const answers = {};
  for (const question of questions) {
    for (;;) {
      const hint = question.current ? (question.secret ? " [Enter keeps the current value]" : ` [${question.current}]`) : "";
      rl.setPrompt(`${question.label}${hint}: `);
      rl.prompt();
      const { value, done } = await lines.next();
      if (done) {
        console.error("\nStopped before every answer was given. Nothing was written.");
        process.exit(1);
      }
      let answer = value.trim() || question.current || "";
      if (question.clean) answer = question.clean(answer);
      const result = question.check(answer);
      if (result !== true) {
        console.log(`  ${answer ? result : "This one is needed."}`);
        continue;
      }
      const warning = question.warn && question.warn(answer);
      if (warning) console.log(`  Note: ${warning}`);
      answers[question.key] = answer;
      break;
    }
  }
  rl.close();
  return answers;
}

function writeEnv(file, service, settings) {
  const body = Object.entries(settings).map(([name, value]) =>
    // The keys are one line with "\n" for line breaks. Quoted, so a parser
    // that stops at spaces still reads all of it; both services accept the
    // key either way.
    /\s/.test(value) ? `${name}="${value}"` : `${name}=${value}`,
  );
  const header = `# Render, ${service}, Environment, Add from .env: paste all of this. Secret: never share it.`;
  fs.writeFileSync(file, `${[header, ...body].join("\n")}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return body.length;
}

(async () => {
  console.log("Paste each value and press Enter. Where a value is shown in [brackets], Enter keeps it.\n");
  const a = await ask();
  const shared = { DATABASE_URL: a.databaseUrl, REDIS_URL: a.redisUrl };
  const web = { FORCE_SSL: "true", ASSUME_SSL: "true", WEB_CONCURRENCY: "0", RAILS_MAX_THREADS: "3" };
  const newKey = () => crypto.randomBytes(64).toString("hex");

  const meetingCount = writeEnv(meetingFile, "roots18-meeting-api", {
    ...shared,
    DB_SCHEMA: "meeting",
    SECRET_KEY_BASE: oldMeeting.SECRET_KEY_BASE || newKey(),
    PLATFORM_JWT_PUBLIC_KEY: secrets.PLATFORM_JWT_PUBLIC_KEY,
    PLATFORM_JWT_ISSUER: "18roots-main-app",
    PLATFORM_JWT_AUDIENCE: "18roots-meeting-service",
    MEETING_CREATOR_ROLES: "service",
    EVENTS_WEBHOOK_URL: `${a.backendUrl}/webhooks/meetings`,
    EVENTS_WEBHOOK_SECRET: secrets.MEETING_EVENTS_SECRET,
    LIVEKIT_API_URL: a.livekitUrl.replace(/^wss:\/\//, "https://"),
    LIVEKIT_PUBLIC_URL: a.livekitUrl,
    LIVEKIT_API_KEY: a.livekitKey,
    LIVEKIT_API_SECRET: a.livekitSecret,
    ALLOW_DEMO_AUTH: "false",
    ...web,
  });

  const backendCount = writeEnv(backendFile, "roots18-main-backend", {
    ...shared,
    DB_SCHEMA: "backend",
    SECRET_KEY_BASE: oldBackend.SECRET_KEY_BASE || newKey(),
    JWT_PRIVATE_KEY: secrets.JWT_PRIVATE_KEY,
    MEETING_SERVICE_URL: a.meetingUrl,
    MEETING_EVENTS_SECRET: secrets.MEETING_EVENTS_SECRET,
    PAYMENT_PROVIDER: "demo",
    // Test server only. Remove these six before real patients (DEPLOY.md).
    DEMO_PAYMENTS: "true",
    ALLOW_DEMO_PAYMENTS_IN_PRODUCTION: "true",
    OTP_FIXED_CODE: "123456",
    ALLOW_TEST_LOGIN_IN_PRODUCTION: "true",
    SEED_DEMO_DATA: "true",
    JOIN_OPENS_MINUTES_BEFORE: "1440",
    ...web,
  });

  console.log(`\nWrote render-deploy/meeting-api.env (${meetingCount} settings) and render-deploy/main-backend.env (${backendCount} settings).`);
  console.log("They hold secrets: open them only on this laptop, and never send them by chat or email.");
})();
