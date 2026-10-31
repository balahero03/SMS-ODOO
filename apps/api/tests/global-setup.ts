import { execSync } from "node:child_process";

export default function setup() {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: "postgresql://sms:sms@localhost:5434/sms_test" },
    stdio: "pipe",
  });
}
