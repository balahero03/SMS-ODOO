import { env } from "../../config/env";
import { prisma } from "../../config/database";

// Reset tokens are stored hashed, so a stored or logged copy of the link must not carry the raw token.
const redactTokens = (text: string) => text.replace(/([?&]token=)[^\s&]+/g, "$1[redacted]");

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
    // Without a provider, the console is the only way to get a link in local development.
    const printed = process.env.NODE_ENV === "production" ? redactTokens(body) : body;
    console.log(`[email] to=${to} subject="${subject}"\n${printed}`);
  }
  await prisma.emailLog.create({ data: { to, subject, body: redactTokens(body), status } });
  return status !== "FAILED";
}
