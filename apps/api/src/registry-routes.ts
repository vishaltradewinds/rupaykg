import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };

function bodyOf(request: Request): Record<string, unknown> {
  return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
}
function str(body: Record<string, unknown>, key: string): string | null {
  return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
}
function positive(body: Record<string, unknown>, key: string): number | null {
  const n = Number(body[key]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) {
    request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null;
  }
}
async function tx<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("begin"); const result = await fn(client); await client.query("commit"); return result; }
  catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function registerRegistryRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/credentials", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const activityId = str(body, "activityId"); const trustRootId = str(body, "trustRootId"); const verificationId = str(body, "verificationId");
    const issuerOrganizationId = str(body, "issuerOrganizationId"); const quantity = positive(body, "quantity"); const unit = str(body, "unit");
    if (!activityId || !trustRootId || !verificationId || !issuerOrganizationId || quantity === null || !unit) return reply.code(400).send({ error: "activityId, trustRootId, verificationId, issuerOrganizationId, positive quantity and unit are required" });
    if (!canActForOrganization(auth, issuerOrganizationId)) return reply.code(403).send({ error: "Issuer organization access denied", code: "ORG_FORBIDDEN" });
    try {
      const credential = await tx(pool, async client => {
        const verification = await client.query<{ id: string; evidence_id: string; activity_id: string | null; decision: string }>(
          "select id, evidence_id, activity_id, decision from verifications where id = $1 for update", [verificationId]);
        if (!verification.rows[0] || verification.rows[0].decision !== "APPROVED") throw Object.assign(new Error("Approved verification required"), { code: "VERIFICATION_REQUIRED" });
        const evidence = await client.query<{ activity_id: string | null; status: string }>("select activity_id, status from evidence where id = $1 for update", [verification.rows[0].evidence_id]);
        if (!evidence.rows[0] || evidence.rows[0].status !== "VERIFIED" || evidence.rows[0].activity_id !== activityId) throw Object.assign(new Error("Verification is not bound to verified activity evidence"), { code: "EVIDENCE_MISMATCH" });
        const activity = await client.query<{ organization_id: string; status: string }>("select organization_id, status from activities where id = $1 for update", [activityId]);
        if (!activity.rows[0] || activity.rows[0].organization_id !== issuerOrganizationId || activity.rows[0].status !== "COMPLETED") throw Object.assign(new Error("Completed activity owned by issuer is required"), { code: "ACTIVITY_NOT_ELIGIBLE" });
        const existing = await client.query("select id from credentials where activity_id = $1 and verification_id = $2", [activityId, verificationId]);
        if (existing.rows[0]) throw Object.assign(new Error("Credential already exists for verification"), { code: "CREDENTIAL_EXISTS" });
        const inserted = await client.query(
          "insert into credentials (activity_id, issuer_organization_id, trust_root_id, status, verification_id, quantity, unit, issued_at) values ($1,$2,$3,'ISSUED',$4,$5,$6,now()) returning *",
          [activityId, issuerOrganizationId, trustRootId, verificationId, quantity, unit]);
        await client.query(
          "insert into registry_events (credential_id, event_type, from_owner_id, to_owner_id, verification_id, recorded_by_identity_id, event_hash) values ($1,'ISSUED',null,$2,$3,$4,$5)",
          [inserted.rows[0].id, issuerOrganizationId, verificationId, auth.identityId, `issue:${inserted.rows[0].id}:${verificationId}`]);
        return inserted.rows[0];
      });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, credential });
    } catch (error) {
      request.log.error(error); const code = (error as { code?: string }).code;
      if (code === "VERIFICATION_REQUIRED" || code === "EVIDENCE_MISMATCH" || code === "ACTIVITY_NOT_ELIGIBLE" || code === "CREDENTIAL_EXISTS") return reply.code(409).send({ error: (error as Error).message, code });
      return reply.code(503).send({ error: "Credential issuance unavailable", syntheticData: false });
    }
  });

  app.post("/api/v1/credentials/:credentialId/activate", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const credentialId = (request.params as { credentialId: string }).credentialId;
    try {
      const credential = await tx(pool, async client => {
        const row = await client.query<{ id: string; status: string; issuer_organization_id: string }>("select id, status, issuer_organization_id from credentials where id = $1 for update", [credentialId]);
        if (!row.rows[0]) throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
        if (!canActForOrganization(auth, row.rows[0].issuer_organization_id)) throw Object.assign(new Error("Organization access denied"), { code: "ORG_FORBIDDEN" });
        if (row.rows[0].status !== "ISSUED") throw Object.assign(new Error("Credential must be ISSUED before activation"), { code: "INVALID_TRANSITION" });
        const updated = await client.query("update credentials set status = 'ACTIVE' where id = $1 returning *", [credentialId]);
        await client.query("insert into registry_events (credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values ($1,'ACTIVATED',$2,$3,$4)", [credentialId, row.rows[0].issuer_organization_id, auth.identityId, `activate:${credentialId}`]);
        return updated.rows[0];
      });
      return { source: "postgresql", syntheticData: false, credential };
    } catch (error) {
      const code = (error as { code?: string }).code; if (code === "NOT_FOUND") return reply.code(404).send({ error: "Credential not found" }); if (code === "ORG_FORBIDDEN") return reply.code(403).send({ error: "Organization access denied", code }); if (code === "INVALID_TRANSITION") return reply.code(409).send({ error: (error as Error).message, code }); request.log.error(error); return reply.code(503).send({ error: "Credential activation unavailable", syntheticData: false });
    }
  });

  app.post("/api/v1/credentials/:credentialId/transfer", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const credentialId = (request.params as { credentialId: string }).credentialId; const body = bodyOf(request as never); const toOwnerId = str(body, "toOwnerId");
    if (!toOwnerId) return reply.code(400).send({ error: "toOwnerId is required" });
    try {
      const result = await tx(pool, async client => {
        const row = await client.query<{ id: string; status: string; issuer_organization_id: string }>("select id,status,issuer_organization_id from credentials where id = $1 for update", [credentialId]);
        if (!row.rows[0]) throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
        const owner = await client.query<{ to_owner_id: string | null }>("select to_owner_id from registry_events where credential_id = $1 and event_type in ('ISSUED','TRANSFERRED') order by created_at desc limit 1", [credentialId]);
        const currentOwner = owner.rows[0]?.to_owner_id;
        if (!currentOwner || !canActForOrganization(auth, currentOwner)) throw Object.assign(new Error("Current owner access denied"), { code: "ORG_FORBIDDEN" });
        if (row.rows[0].status !== "ACTIVE") throw Object.assign(new Error("Only ACTIVE credentials can be transferred"), { code: "INVALID_TRANSITION" });
        const target = await client.query("select id from organizations where id = $1", [toOwnerId]); if (!target.rows[0]) throw Object.assign(new Error("Destination organization not found"), { code: "DESTINATION_NOT_FOUND" });
        await client.query("update credentials set status = 'TRANSFERRED' where id = $1", [credentialId]);
        const event = await client.query("insert into registry_events (credential_id,event_type,from_owner_id,to_owner_id,recorded_by_identity_id,event_hash) values ($1,'TRANSFERRED',$2,$3,$4,$5) returning *", [credentialId,currentOwner,toOwnerId,auth.identityId,`transfer:${credentialId}:${currentOwner}:${toOwnerId}:${Date.now()}`]);
        return event.rows[0];
      });
      return { source: "postgresql", syntheticData: false, registryEvent: result };
    } catch (error) { const code = (error as { code?: string }).code; if (code === "NOT_FOUND") return reply.code(404).send({ error: "Credential not found" }); if (code === "ORG_FORBIDDEN") return reply.code(403).send({ error: "Current owner access denied", code }); if (code === "INVALID_TRANSITION" || code === "DESTINATION_NOT_FOUND") return reply.code(409).send({ error: (error as Error).message, code }); request.log.error(error); return reply.code(503).send({ error: "Credential transfer unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/credentials/:credentialId/retire", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const credentialId = (request.params as { credentialId: string }).credentialId;
    try {
      const result = await tx(pool, async client => {
        const row = await client.query<{ status: string }>("select status from credentials where id = $1 for update", [credentialId]);
        if (!row.rows[0]) throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
        const owner = await client.query<{ owner_id: string | null }>("select coalesce(to_owner_id,from_owner_id) as owner_id from registry_events where credential_id = $1 order by created_at desc limit 1", [credentialId]);
        if (!owner.rows[0]?.owner_id || !canActForOrganization(auth, owner.rows[0].owner_id)) throw Object.assign(new Error("Current owner access denied"), { code: "ORG_FORBIDDEN" });
        if (!["ACTIVE","TRANSFERRED"].includes(row.rows[0].status)) throw Object.assign(new Error("Credential is not retireable"), { code: "INVALID_TRANSITION" });
        await client.query("update credentials set status = 'RETIRED' where id = $1", [credentialId]);
        const event = await client.query("insert into registry_events (credential_id,event_type,from_owner_id,recorded_by_identity_id,event_hash) values ($1,'RETIRED',$2,$3,$4) returning *", [credentialId,owner.rows[0].owner_id,auth.identityId,`retire:${credentialId}:${Date.now()}`]);
        return event.rows[0];
      });
      return { source: "postgresql", syntheticData: false, registryEvent: result };
    } catch (error) { const code = (error as { code?: string }).code; if (code === "NOT_FOUND") return reply.code(404).send({ error: "Credential not found" }); if (code === "ORG_FORBIDDEN") return reply.code(403).send({ error: "Current owner access denied", code }); if (code === "INVALID_TRANSITION") return reply.code(409).send({ error: (error as Error).message, code }); request.log.error(error); return reply.code(503).send({ error: "Credential retirement unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/settlements", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never); const credentialId = str(body, "credentialId"); const payerId = str(body, "payerId"); const payeeId = str(body, "payeeId"); const amount = positive(body, "amount"); const currency = str(body, "currency");
    if (!credentialId || !payerId || !payeeId || amount === null || !currency || currency.length !== 3) return reply.code(400).send({ error: "credentialId, payerId, payeeId, positive amount and 3-letter currency are required" });
    if (!canActForOrganization(auth, payerId) && !canActForOrganization(auth, payeeId)) return reply.code(403).send({ error: "Settlement party access denied", code: "ORG_FORBIDDEN" });
    try {
      const settlement = await tx(pool, async client => {
        const credential = await client.query<{ status: string }>("select status from credentials where id = $1 for update", [credentialId]);
        if (!credential.rows[0]) throw Object.assign(new Error("Credential not found"), { code: "NOT_FOUND" });
        if (!["ACTIVE","TRANSFERRED","RETIRED"].includes(credential.rows[0].status)) throw Object.assign(new Error("Credential must have an authoritative registry state before settlement"), { code: "REGISTRY_REQUIRED" });
        const event = await client.query("select id from registry_events where credential_id = $1 and event_type in ('ISSUED','TRANSFERRED','RETIRED') order by created_at desc limit 1", [credentialId]);
        if (!event.rows[0]) throw Object.assign(new Error("Authoritative registry event required"), { code: "REGISTRY_REQUIRED" });
        const inserted = await client.query("insert into settlements (credential_id,payer_id,payee_id,amount,currency,status,external_reference) values ($1,$2,$3,$4,$5,'CREATED',$6) returning *", [credentialId,payerId,payeeId,amount,currency,str(body,'externalReference')]);
        return inserted.rows[0];
      });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, settlement });
    } catch (error) { const code = (error as { code?: string }).code; if (code === "NOT_FOUND") return reply.code(404).send({ error: "Credential not found" }); if (code === "REGISTRY_REQUIRED") return reply.code(409).send({ error: (error as Error).message, code }); request.log.error(error); return reply.code(503).send({ error: "Settlement creation unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/settlements/:settlementId/authorize", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const settlementId = (request.params as { settlementId: string }).settlementId; const body = bodyOf(request as never); const authorizationReference = str(body,'authorizationReference');
    if (!authorizationReference) return reply.code(400).send({ error: "authorizationReference is required" });
    try {
      const result = await tx(pool, async client => {
        const row = await client.query<{ status: string; payer_id: string; payee_id: string }>("select status,payer_id,payee_id from settlements where id = $1 for update", [settlementId]);
        if (!row.rows[0]) throw Object.assign(new Error("Settlement not found"), { code: "NOT_FOUND" });
        if (!canActForOrganization(auth, row.rows[0].payer_id) && !canActForOrganization(auth, row.rows[0].payee_id)) throw Object.assign(new Error("Settlement party access denied"), { code: "ORG_FORBIDDEN" });
        if (row.rows[0].status !== 'CREATED') throw Object.assign(new Error("Settlement must be CREATED before authorization"), { code: "INVALID_TRANSITION" });
        const updated = await client.query("update settlements set status='AUTHORIZED', authorization_reference=$2, verified_at=now() where id=$1 returning *", [settlementId,authorizationReference]);
        await client.query("insert into settlement_events (settlement_id,event_type,actor_identity_id,external_reference,event_hash) values ($1,'AUTHORIZED',$2,$3,$4)", [settlementId,auth.identityId,authorizationReference,`authorize:${settlementId}:${authorizationReference}`]);
        return updated.rows[0];
      });
      return { source: "postgresql", syntheticData: false, settlement: result };
    } catch (error) { const code=(error as {code?:string}).code; if(code==='NOT_FOUND') return reply.code(404).send({error:'Settlement not found'}); if(code==='ORG_FORBIDDEN') return reply.code(403).send({error:'Settlement party access denied',code}); if(code==='INVALID_TRANSITION') return reply.code(409).send({error:(error as Error).message,code}); request.log.error(error); return reply.code(503).send({error:'Settlement authorization unavailable',syntheticData:false}); }
  });

  app.post("/api/v1/settlements/:settlementId/settle", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const settlementId = (request.params as { settlementId: string }).settlementId; const body = bodyOf(request as never); const externalReference = str(body,'externalReference');
    if (!externalReference) return reply.code(400).send({ error: "externalReference is required" });
    try {
      const result = await tx(pool, async client => {
        const row = await client.query<{ status: string; payer_id: string; payee_id: string }>("select status,payer_id,payee_id from settlements where id=$1 for update",[settlementId]);
        if(!row.rows[0]) throw Object.assign(new Error('Settlement not found'),{code:'NOT_FOUND'});
        if(!canActForOrganization(auth,row.rows[0].payer_id) && !canActForOrganization(auth,row.rows[0].payee_id)) throw Object.assign(new Error('Settlement party access denied'),{code:'ORG_FORBIDDEN'});
        if(row.rows[0].status!=='AUTHORIZED') throw Object.assign(new Error('Settlement must be AUTHORIZED before execution'),{code:'INVALID_TRANSITION'});
        await client.query("update settlements set status='EXECUTING', external_reference=$2 where id=$1",[settlementId,externalReference]);
        await client.query("insert into settlement_events (settlement_id,event_type,actor_identity_id,external_reference,event_hash) values ($1,'EXECUTING',$2,$3,$4)",[settlementId,auth.identityId,externalReference,`execute:${settlementId}:${externalReference}`]);
        return client.query("update settlements set status='RECONCILING' where id=$1 returning *",[settlementId]).then(r=>r.rows[0]);
      });
      return { source:'postgresql', syntheticData:false, settlement:result };
    } catch(error){const code=(error as {code?:string}).code;if(code==='NOT_FOUND')return reply.code(404).send({error:'Settlement not found'});if(code==='ORG_FORBIDDEN')return reply.code(403).send({error:'Settlement party access denied',code});if(code==='INVALID_TRANSITION')return reply.code(409).send({error:(error as Error).message,code});request.log.error(error);return reply.code(503).send({error:'Settlement execution unavailable',syntheticData:false});}
  });

  app.post("/api/v1/settlements/:settlementId/confirm", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const settlementId = (request.params as { settlementId: string }).settlementId;
    const body = bodyOf(request as never); const confirmationReference = str(body, 'confirmationReference');
    if (!confirmationReference) return reply.code(400).send({ error: "confirmationReference is required from the external settlement authority" });
    try {
      const result = await tx(pool, async client => {
        const row = await client.query<{ status: string; payer_id: string; payee_id: string }>("select status,payer_id,payee_id from settlements where id=$1 for update",[settlementId]);
        if(!row.rows[0]) throw Object.assign(new Error('Settlement not found'),{code:'NOT_FOUND'});
        if(!canActForOrganization(auth,row.rows[0].payer_id) && !canActForOrganization(auth,row.rows[0].payee_id)) throw Object.assign(new Error('Settlement party access denied'),{code:'ORG_FORBIDDEN'});
        if(row.rows[0].status!=='RECONCILING') throw Object.assign(new Error('Settlement must be RECONCILING before confirmation'),{code:'INVALID_TRANSITION'});
        const updated=await client.query("update settlements set status='SETTLED', settled_at=now() where id=$1 returning *",[settlementId]);
        await client.query("insert into settlement_events (settlement_id,event_type,actor_identity_id,external_reference,event_hash) values ($1,'SETTLED',$2,$3,$4)",[settlementId,auth.identityId,confirmationReference,`settled:${settlementId}:${confirmationReference}`]);
        return updated.rows[0];
      });
      return {source:'postgresql',syntheticData:false,settlement:result};
    }catch(error){const code=(error as {code?:string}).code;if(code==='NOT_FOUND')return reply.code(404).send({error:'Settlement not found'});if(code==='ORG_FORBIDDEN')return reply.code(403).send({error:'Settlement party access denied',code});if(code==='INVALID_TRANSITION')return reply.code(409).send({error:(error as Error).message,code});request.log.error(error);return reply.code(503).send({error:'Settlement confirmation unavailable',syntheticData:false});}
  });
}
