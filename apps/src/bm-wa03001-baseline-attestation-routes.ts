import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { sha256Canonical } from "@rupaykg/carbon";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { baselineAttestationConfig, baselineAttestationPublicJwk, signBaselineAttestation } from "./bm-wa03001-baseline-attestation.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { params: Record<string, string>; log: { error: (error: unknown) => void } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}

export async function registerBmWa03001BaselineAttestationRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/.well-known/rupaykg-baseline-jwks.json", async (_request, reply) => {
    const config = baselineAttestationConfig();
    if (!config) return reply.code(503).send({ error: "Baseline attestation signer is not configured", code: "BASELINE_SIGNER_NOT_CONFIGURED", syntheticData: false });
    try {
      const publicJwk = baselineAttestationPublicJwk(config);
      return { keys: [{ ...publicJwk, kid: config.keyId, use: "sig", alg: "EdDSA" }], issuer: config.issuerDid, credentialType: "RupayKgBaselineAttestation" };
    } catch { return reply.code(503).send({ error: "Baseline attestation public key unavailable", code: "BASELINE_PUBLIC_KEY_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/mrv/bm-wa03001/baselines/:baselineId/attest", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const baselineId = (request.params as { baselineId: string }).baselineId;
    if (!UUID.test(baselineId)) return reply.code(400).send({ error: "Valid baselineId required", code: "BASELINE_ID_INVALID" });
    const config = baselineAttestationConfig();
    if (!config) return reply.code(503).send({ error: "Signer is not configured with a DID, matching key ID and Ed25519 private key", code: "BASELINE_SIGNER_NOT_CONFIGURED", syntheticData: false });
    try {
      const baselineResult = await pool.query<{
        id:string; organization_id:string; activity_id:string; methodology_code:string; methodology_version:string;
        baseline_fch4_tch4:string; baseline_period:string; evidence_ids:string[]; record_sha256:string; status:string;
        submitted_by_identity_id:string; approved_by_identity_id:string|null; approved_at:Date|string|null;
      }>("select * from bm_wa03001_baseline_records where id=$1", [baselineId]);
      const baseline = baselineResult.rows[0];
      if (!baseline || !canActForOrganization(auth, baseline.organization_id)) return reply.code(404).send({ error: "Baseline not found in authorized organization", code: "BASELINE_NOT_FOUND" });
      if (!await hasOrganizationPermission(pool, auth, baseline.organization_id, ["guardian:write"])) return reply.code(403).send({ error: "Guardian write permission required", code: "BASELINE_ATTESTATION_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, baseline.organization_id, ["projects:verify", "VERIFY_EVIDENCE"])) return reply.code(403).send({ error: "Verification permission required", code: "BASELINE_ATTESTATION_REVIEW_PERMISSION_REQUIRED" });
      if (baseline.status !== "APPROVED" || !baseline.approved_by_identity_id || !baseline.approved_at || baseline.approved_by_identity_id === baseline.submitted_by_identity_id) {
        return reply.code(409).send({ error: "Only independently approved baselines can receive attestations", code: "BASELINE_NOT_APPROVED" });
      }
      const core = {
        activityId: baseline.activity_id, organizationId: baseline.organization_id, methodologyCode: baseline.methodology_code,
        methodologyVersion: baseline.methodology_version, baselineFch4Tch4: Number(baseline.baseline_fch4_tch4),
        baselinePeriod: baseline.baseline_period, evidenceIds: [...baseline.evidence_ids].sort(),
        submittedByIdentityId: baseline.submitted_by_identity_id,
      };
      if (sha256Canonical(core) !== baseline.record_sha256) return reply.code(409).send({ error: "Baseline record integrity hash mismatch", code: "BASELINE_HASH_MISMATCH" });
      const evidence = await pool.query<{ count:string }>(
        "select count(*)::text count from evidence where activity_id=$1 and id=any($2::uuid[]) and status='VERIFIED' and (content_hash is not null or content_uri is not null)",
        [baseline.activity_id, baseline.evidence_ids]);
      if (Number(evidence.rows[0]?.count ?? 0) !== baseline.evidence_ids.length) return reply.code(409).send({ error: "Baseline evidence must remain VERIFIED and content-addressed", code: "BASELINE_EVIDENCE_NOT_VERIFIED" });
      const existing = await pool.query<{ id:string }>("select id from bm_wa03001_baseline_attestations where baseline_record_id=$1", [baselineId]);
      if (existing.rows[0]) return reply.code(409).send({ error: "A signed attestation already exists for this baseline; credentials are not silently reissued", code: "BASELINE_ATTESTATION_EXISTS" });
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + 90 * 24 * 60 * 60;
      const signed = signBaselineAttestation({
        issuerDid: config.issuerDid, keyId: config.keyId, baselineRecordId: baseline.id,
        activityId: baseline.activity_id, organizationId: baseline.organization_id,
        methodologyCode: "BM WA03.001", methodologyVersion: "1.0",
        baselineFch4Tch4: Number(baseline.baseline_fch4_tch4), baselinePeriod: baseline.baseline_period,
        baselineRecordSha256: baseline.record_sha256, baselineEvidenceIds: baseline.evidence_ids,
        approvedByIdentityId: baseline.approved_by_identity_id, approvedAt: new Date(baseline.approved_at).toISOString(),
        issuedAt, expiresAt,
      }, config);
      const client = await pool.connect();
      try {
        await client.query("begin");
        const inserted = await client.query(
          `insert into bm_wa03001_baseline_attestations
           (baseline_record_id,organization_id,activity_id,credential_jwt,credential_sha256,issuer_did,signing_key_id,public_jwk,issued_by_identity_id,issued_at,expires_at)
           values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,to_timestamp($10),to_timestamp($11))
           on conflict (baseline_record_id) do nothing
           returning id,baseline_record_id,credential_sha256,issuer_did,signing_key_id,issued_at,expires_at`,
          [baseline.id, baseline.organization_id, baseline.activity_id, signed.jwt, signed.sha256, config.issuerDid, config.keyId,
            JSON.stringify({ ...signed.publicJwk, kid: config.keyId, use: "sig", alg: "EdDSA" }), auth.identityId, issuedAt, expiresAt]);
        if (!inserted.rows[0]) {
          await client.query("rollback");
          return reply.code(409).send({ error: "An attestation was concurrently issued for this baseline", code: "BASELINE_ATTESTATION_EXISTS" });
        }
        await client.query("commit");
        return reply.code(201).send({
          source: "postgresql", syntheticData: false, attestation: inserted.rows[0],
          credentialJwt: signed.jwt,
          verification: { issuer: config.issuerDid, keyId: config.keyId, algorithm: "EdDSA", publicKeyEndpoint: "/.well-known/rupaykg-baseline-jwks.json" },
          note: "Signed baseline attestation only. Guardian must verify this VC-JWT and issuer trust before translating it into a Guardian-native VC document. This is not a carbon-credit credential, BEE approval, verified reduction or issued CCC.",
        });
      } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
      finally { client.release(); }
    } catch (error) {
      if (error instanceof Error && /Ed25519|attestation claim|issuer\/key/.test(error.message)) return reply.code(503).send({ error: "Baseline signer configuration or claim validation failed", code: "BASELINE_SIGNER_INVALID", syntheticData: false });
      request.log.error(error); return reply.code(503).send({ error: "Baseline attestation unavailable", code: "BASELINE_ATTESTATION_UNAVAILABLE", syntheticData: false });
    }
  });
}
