import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";

type Body = Record<string, unknown>;
const read = (body: Body, key: string) => typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const token = () => randomBytes(32).toString("base64url");

export function normalizeRecoveryOrigin(configured: string | undefined): string | null {
  const candidate = configured?.split(",")[0]?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch { return null; }
}

async function deliver(to: string, subject: string, text: string): Promise<boolean> {
  const endpoint = process.env.RUPAYKG_EMAIL_DELIVERY_URL?.trim();
  const secret = process.env.RUPAYKG_EMAIL_DELIVERY_TOKEN?.trim();
  if (!endpoint || !secret) return false;
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { return false; }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return false;
  try {
    const response = await fetch(parsed, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ to, subject, text, source: "rupaykg-native-auth" }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch { return false; }
}

// The database login does not inherit application privileges. Every auth
// endpoint that touches tenant-protected identity/token tables must assume the
// runtime role inside a transaction, matching authenticate() and tenant routes.
async function withRuntimeRole<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role rupaykg_app_runtime");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function createToken(pool: Pool, table: "identity_email_verification_tokens" | "identity_password_reset_tokens", identityId: string): Promise<string | null> {
  return withRuntimeRole(pool, async (client) => {
    const recent = await client.query<{ count: string; last_created_at: Date | null }>(
      `select count(*)::text as count,max(created_at) as last_created_at from ${table} where identity_id=$1 and created_at>now()-interval '1 hour'`,
      [identityId],
    );
    if (Number(recent.rows[0]?.count ?? 0) >= 5) return null;
    if (recent.rows[0]?.last_created_at && recent.rows[0].last_created_at.getTime() > Date.now() - 60_000) return null;
    const value = token();
    await client.query(`update ${table} set consumed_at=now() where identity_id=$1 and consumed_at is null`, [identityId]);
    await client.query(`insert into ${table}(identity_id,token_hash,expires_at) values($1,$2,now()+interval '30 minutes')`, [identityId,digest(value)]);
    return value;
  });
}

export async function sendVerification(pool: Pool, identityId: string, email: string): Promise<boolean> {
  const value = await createToken(pool, "identity_email_verification_tokens", identityId);
  if (!value) return false;
  const origin = normalizeRecoveryOrigin(process.env.RUPAYKG_ALLOWED_ORIGINS);
  if (!origin) return false;
  return deliver(email, "Verify your RupayKg email address", `Verify your email within 30 minutes: ${origin}/verify-email?token=${encodeURIComponent(value)}`);
}

export async function registerEmailRecoveryRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/auth/email/verify", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const value = read((request.body ?? {}) as Body, "token");
    if (!value || value.length > 256) return reply.code(400).send({ error: "A valid verification token is required", code: "INVALID_TOKEN" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      const found = await client.query<{ identity_id: string }>(
        "select identity_id from identity_email_verification_tokens where token_hash=$1 and consumed_at is null and expires_at>now() for update",
        [digest(value)],
      );
      const identityId = found.rows[0]?.identity_id;
      if (!identityId) { await client.query("rollback"); return reply.code(400).send({ error: "Verification link is invalid or expired", code: "TOKEN_INVALID_OR_EXPIRED" }); }
      await client.query("update identity_email_verification_tokens set consumed_at=now() where token_hash=$1", [digest(value)]);
      await client.query("update identities set status='VERIFIED',email_verified_at=now() where id=$1 and suspended_at is null", [identityId]);
      await client.query("commit");
      return { verified: true, message: "Email address verified. You can now sign in." };
    } catch (error) { await client.query("rollback"); request.log.error(error); return reply.code(503).send({ error: "Email verification unavailable", code: "VERIFICATION_UNAVAILABLE" }); }
    finally { client.release(); }
  });

  app.post("/api/v1/auth/email/resend", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const email = read((request.body ?? {}) as Body, "email")?.toLowerCase();
    if (!email) return reply.code(400).send({ error: "Email is required", code: "INVALID_EMAIL" });
    const result = await withRuntimeRole(pool, (client) => client.query<{ id: string; email: string }>("select id,email from identities where lower(email)=lower($1) and status='PENDING' limit 1", [email]));
    if (result.rows[0]) {
      const sent = await sendVerification(pool, result.rows[0].id, result.rows[0].email);
      if (!sent) request.log.warn("Email verification delivery is not configured or failed");
    }
    return { message: "If the account requires verification, a new link will be sent." };
  });

  app.post("/api/v1/auth/password/request-reset", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const email = read((request.body ?? {}) as Body, "email")?.toLowerCase();
    if (!email) return reply.code(400).send({ error: "Email is required", code: "INVALID_EMAIL" });
    const result = await withRuntimeRole(pool, (client) => client.query<{ id: string; email: string }>("select id,email from identities where lower(email)=lower($1) and status='VERIFIED' and suspended_at is null limit 1", [email]));
    if (result.rows[0]) {
      const value = await createToken(pool, "identity_password_reset_tokens", result.rows[0].id);
      const origin = normalizeRecoveryOrigin(process.env.RUPAYKG_ALLOWED_ORIGINS);
      const sent = value && origin ? await deliver(result.rows[0].email, "Reset your RupayKg password", `Reset your password within 30 minutes: ${origin}/reset-password?token=${encodeURIComponent(value)}`) : false;
      if (!sent) request.log.warn("Password recovery email delivery is not configured or failed");
    }
    return { message: "If an eligible account exists, password reset instructions will be sent." };
  });

  app.post("/api/v1/auth/password/reset", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const body = (request.body ?? {}) as Body;
    const value = read(body, "token");
    const password = read(body, "password");
    if (!value || value.length > 256 || !password || password.length < 10 || password.length > 200)
      return reply.code(400).send({ error: "A valid reset token and password of 10–200 characters are required", code: "INVALID_RESET" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      const found = await client.query<{ identity_id: string }>(
        "select identity_id from identity_password_reset_tokens where token_hash=$1 and consumed_at is null and expires_at>now() for update",
        [digest(value)],
      );
      const identityId = found.rows[0]?.identity_id;
      if (!identityId) { await client.query("rollback"); return reply.code(400).send({ error: "Password reset link is invalid or expired", code: "TOKEN_INVALID_OR_EXPIRED" }); }
      const salt = randomBytes(16).toString("base64url");
      const { scryptSync } = await import("node:crypto");
      const passwordHash = scryptSync(password, salt, 64).toString("base64url");
      await client.query("update identity_password_credentials set password_hash=$2,password_salt=$3,password_changed_at=now(),failed_attempts=0,locked_until=null where identity_id=$1", [identityId,passwordHash,salt]);
      await client.query("update identity_password_reset_tokens set consumed_at=now() where identity_id=$1 and consumed_at is null", [identityId]);
      await client.query("update identity_sessions set revoked_at=now() where identity_id=$1 and revoked_at is null", [identityId]);
      await client.query("commit");
      return { reset: true, message: "Password updated. Please sign in again." };
    } catch (error) { await client.query("rollback"); request.log.error(error); return reply.code(503).send({ error: "Password reset unavailable", code: "RESET_UNAVAILABLE" }); }
    finally { client.release(); }
  });
}
