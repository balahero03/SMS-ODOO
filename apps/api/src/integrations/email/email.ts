import { env } from "../../config/env";
import { prisma } from "../../config/database";

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  let status = "LOGGED";
  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text: body }),
    }).catch(() => null);
    status = res?.ok ? "SENT" : "FAILED";
  } else if (process.env.NODE_ENV !== "test") {
    console.log(`[email] to=${to} subject="${subject}"\n${body}`);
  }
  await prisma.emailLog.create({ data: { to, subject, body, status } });
  return status !== "FAILED";
}
