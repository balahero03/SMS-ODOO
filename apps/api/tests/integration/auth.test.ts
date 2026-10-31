import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/modules/auth/auth.service";

const api = "/api/v1";
const PASSWORD = "Str0ng@Pass";
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
let admin: string, staff: string;
let seq = 0;
let sent: { to: string; text: string }[] = [];
let deliver = true;

const email = () => `auth-${++seq}@test.dev`;
const signup = async (over: Record<string, unknown> = {}) =>
  request(app).post(`${api}/auth/signup`).send({ name: "Priya", email: email(), password: PASSWORD, ...over });
const login = async (address: string, password = PASSWORD) => request(app).post(`${api}/auth/login`).send({ email: address, password });

async function requestToken(address: string) {
  const before = sent.length;
  await request(app).post(`${api}/auth/forgot-password`).send({ email: address }).expect(200);
  // The route answers before the email goes out.
  await vi.waitFor(() => expect(sent.length).toBeGreaterThan(before));
  return /token=(\w+)/.exec(sent.at(-1)!.text)![1];
}

beforeAll(async () => {
  env.RESEND_API_KEY = "test-key";
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    if (!deliver) throw new Error("provider down");
    return { ok: true };
  });
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { email: "auth-admin@test.dev", name: "A", role: "ADMIN", passwordHash },
      { email: "auth-staff@test.dev", name: "S", role: "STAFF", passwordHash },
    ],
  });
  admin = (await login("auth-admin@test.dev")).body.token;
  staff = (await login("auth-staff@test.dev")).body.token;
});

beforeEach(() => {
  sent = [];
  deliver = true;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.$disconnect();
});

describe("password policy", () => {
  it.each([
    ["exactly eight characters", "Abcdef@1"],
    ["no uppercase letter", "abcdefg@1"],
    ["no lowercase letter", "ABCDEFG@1"],
    ["no special character", "Abcdefgh1"],
    ["more than 72 characters", `Aa@${"x".repeat(70)}`],
    ["more than 72 bytes", `Aa@${"é".repeat(40)}`],
  ])("refuses a password with %s", async (_name, password) => {
    expect((await signup({ password })).status).toBe(400);
  });

  it.each([
    ["nine characters", "Abcdefg@1"],
    ["72 characters", `Aa@${"x".repeat(69)}`],
  ])("accepts a password with %s", async (_name, password) => {
    expect((await signup({ password })).status).toBe(201);
  });
});

describe("registration", () => {
  it("creates a customer, stores only a hash, and returns no password data", async () => {
    const address = email();
    const res = await signup({ email: address });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: address, role: "CUSTOMER" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    expect(user.passwordHash).not.toContain(PASSWORD);
  });

  it("refuses a duplicate email in any case, and bad input", async () => {
    const address = email();
    await signup({ email: address });
    const duplicate = await signup({ email: address.toUpperCase() });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe("That email already has an account");
    expect((await signup({ email: "not-an-email" })).status).toBe(400);
    expect((await signup({ name: " " })).status).toBe(400);
  });

  it("ignores a role in the payload", async () => {
    const res = await signup({ role: "ADMIN" });
    expect(res.body.user.role).toBe("CUSTOMER");
  });
});

describe("login and logout", () => {
  it("gives the same answer for a wrong password, unknown email and inactive account", async () => {
    const address = email();
    await signup({ email: address });
    const wrong = await login(address, "Wr0ng@Password");
    const unknown = await login("auth-nobody@test.dev");
    await prisma.user.update({ where: { email: address }, data: { active: false } });
    const inactive = await login(address);
    for (const res of [wrong, unknown, inactive]) {
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Incorrect email or password");
    }
  });

  it("logs in, restores the user from the token, and revokes it on logout", async () => {
    const address = email();
    await signup({ email: address });
    const { token } = (await login(address)).body;
    const me = await request(app).get(`${api}/auth/me`).set(as(token)).expect(200);
    expect(me.body.user.email).toBe(address);
    await request(app).post(`${api}/auth/logout`).set(as(token)).send({}).expect(204);
    await request(app).get(`${api}/auth/me`).set(as(token)).expect(401);
    await request(app).post(`${api}/auth/logout`).set(as(token)).send({}).expect(401);
    await login(address).then((res) => expect(res.status).toBe(200));
  });

  it("refuses missing and malformed tokens", async () => {
    await request(app).get(`${api}/auth/me`).expect(401);
    await request(app).get(`${api}/auth/me`).set(as("not-a-token")).expect(401);
    await request(app).post(`${api}/auth/logout`).expect(401);
  });
});

describe("password reset", () => {
  it("sends a working single-use link and never stores the raw token", async () => {
    const address = email();
    await signup({ email: address });
    const token = await requestToken(address);
    const response = await request(app).post(`${api}/auth/reset-password`).send({ token, password: "N3w@Password" }).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(token);
    await request(app).post(`${api}/auth/reset-password`).send({ token, password: "N3w@Password2" }).expect(400);
    await login(address, "N3w@Password").then((res) => expect(res.status).toBe(200));
    await login(address).then((res) => expect(res.status).toBe(401));
    const log = await prisma.emailLog.findFirstOrThrow({ where: { to: address } });
    expect(log.body).not.toContain(token);
    expect(log.body).toContain("token=[redacted]");
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { user: { email: address } } });
    expect(row.tokenHash).not.toBe(token);
  });

  it("refuses expired and unknown tokens, and weak new passwords", async () => {
    const address = email();
    await signup({ email: address });
    const token = await requestToken(address);
    await request(app).post(`${api}/auth/reset-password`).send({ token, password: "weak" }).expect(400);
    await prisma.passwordResetToken.updateMany({ where: { user: { email: address } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await request(app).post(`${api}/auth/reset-password`).send({ token, password: "N3w@Password" }).expect(400);
    expect(expired.body.message).toBe("This reset link is invalid or has expired");
    await request(app).post(`${api}/auth/reset-password`).send({ token: "unknown", password: "N3w@Password" }).expect(400);
  });

  it("cancels other outstanding links after a reset", async () => {
    const address = email();
    await signup({ email: address });
    const first = await requestToken(address);
    const second = await requestToken(address);
    await request(app).post(`${api}/auth/reset-password`).send({ token: second, password: "N3w@Password" }).expect(200);
    await request(app).post(`${api}/auth/reset-password`).send({ token: first, password: "Oth3r@Password" }).expect(400);
  });

  it("answers the same for known and unknown emails, even when delivery fails", async () => {
    const address = email();
    await signup({ email: address });
    deliver = false;
    const known = await request(app).post(`${api}/auth/forgot-password`).send({ email: address }).expect(200);
    const unknown = await request(app).post(`${api}/auth/forgot-password`).send({ email: "auth-nobody@test.dev" }).expect(200);
    expect(known.body).toEqual(unknown.body);
    await vi.waitFor(() => expect(sent.some((m) => m.to === address)).toBe(true));
    expect(sent.some((m) => m.to === "auth-nobody@test.dev")).toBe(false);
  });
});

describe("staff management", () => {
  it("lets only the admin list and create staff", async () => {
    const customer = (await signup()).body.token;
    const body = { name: "New", email: email() };
    for (const token of [staff, customer]) {
      await request(app).get(`${api}/users/staff`).set(as(token)).expect(403);
      await request(app).post(`${api}/users/staff`).set(as(token)).send(body).expect(403);
    }
    await request(app).get(`${api}/users/staff`).expect(401);
    await request(app).post(`${api}/users/staff`).send(body).expect(401);
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull();
    const list = await request(app).get(`${api}/users/staff`).set(as(admin)).expect(200);
    expect(JSON.stringify(list.body)).not.toContain("passwordHash");
  });

  it("always creates STAFF, whatever role the payload claims", async () => {
    const res = await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "New", email: email(), role: "ADMIN" }).expect(201);
    expect(res.body).toMatchObject({ role: "STAFF", inviteSent: true });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("refuses duplicates and invalid details", async () => {
    const address = email();
    await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "New", email: address }).expect(201);
    const duplicate = await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "Again", email: address }).expect(409);
    expect(duplicate.body.message).toBe("That email already has an account");
    await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "", email: email() }).expect(400);
    await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "New", email: "nope" }).expect(400);
  });

  it("reports an invite that couldn't be delivered", async () => {
    deliver = false;
    const res = await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "New", email: email() }).expect(201);
    expect(res.body.inviteSent).toBe(false);
  });

  it("can't promote through PATCH, and staff can't use PATCH at all", async () => {
    const created = await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "New", email: email() }).expect(201);
    const res = await request(app).patch(`${api}/users/staff/${created.body.id}`).set(as(admin)).send({ active: true, role: "ADMIN" }).expect(200);
    expect(res.body.role).toBe("STAFF");
    const self = await prisma.user.findUniqueOrThrow({ where: { email: "auth-staff@test.dev" } });
    await request(app).patch(`${api}/users/staff/${self.id}`).set(as(staff)).send({ active: true }).expect(403);
    await request(app).patch(`${api}/users/staff/${self.id}`).set(as(staff)).send({ role: "ADMIN" }).expect(403);
  });

  it("protects the admin's own account and non-staff targets", async () => {
    const self = await prisma.user.findUniqueOrThrow({ where: { email: "auth-admin@test.dev" } });
    await request(app).patch(`${api}/users/staff/${self.id}`).set(as(admin)).send({ active: false }).expect(400);
    const customer = (await signup()).body.user;
    await request(app).patch(`${api}/users/staff/${customer.id}`).set(as(admin)).send({ active: false }).expect(404);
  });

  it("signs out deactivated staff for good, even after reactivation", async () => {
    const address = email();
    const created = await request(app).post(`${api}/users/staff`).set(as(admin)).send({ name: "New", email: address }).expect(201);
    await prisma.user.update({ where: { id: created.body.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
    const { token } = (await login(address)).body;
    const url = `${api}/users/staff/${created.body.id}`;
    await request(app).patch(url).set(as(admin)).send({ active: false }).expect(200);
    await request(app).get(`${api}/auth/me`).set(as(token)).expect(401);
    await request(app).patch(url).set(as(admin)).send({ active: true }).expect(200);
    await request(app).get(`${api}/auth/me`).set(as(token)).expect(401);
  });
});
