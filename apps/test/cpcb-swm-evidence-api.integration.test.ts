import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import test from "node:test";
import { initialSwmChecklist } from "@rupaykg/domain";

const databaseUrl = process.env.RUPAYKG_CPCB_TEST_DATABASE_URL;
const apiDir = fileURLToPath(new URL("../..", import.meta.url));
const port = Number(process.env.RUPAYKG_CPCB_TEST_PORT ?? 43131);
const baseUrl = `http://127.0.0.1:${port}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");

async function waitFor(url: string, child: ChildProcess): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (child.exitCode !== null) throw new Error(`CPCB test API exited: ${child.exitCode}`);
    try { if ((await fetch(url)).status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function apiRequest(path: string, bearer: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${bearer}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

test("CPCB evidence API enforces organization isolation and leaves official CPCB status unchanged", {
  skip: !databaseUrl ? "RUPAYKG_CPCB_TEST_DATABASE_URL must point to a disposable migrated PostgreSQL database" : false,
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 4 });
  let server: ChildProcess | null = null;
  let serverError = "";
  try {
    const suffix = randomUUID();
    const orgA = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'ULB') returning id", [`CPCB API test A ${suffix}`],
    )).rows[0]!.id;
    const orgB = (await pool.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'ULB') returning id", [`CPCB API test B ${suffix}`],
    )).rows[0]!.id;
    const geoA = (await pool.query<{id:string}>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`CPCB-A-${suffix}`, `CPCB geography A ${suffix}`],
    )).rows[0]!.id;
    const geoB = (await pool.query<{id:string}>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`CPCB-B-${suffix}`, `CPCB geography B ${suffix}`],
    )).rows[0]!.id;
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2),($3,$4)", [orgA, geoA, orgB, geoB]);

    const identityA = (await pool.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id", [`cpcb-a-${suffix}`, "CPCB API Test A"],
    )).rows[0]!.id;
    const identityB = (await pool.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id", [`cpcb-b-${suffix}`, "CPCB API Test B"],
    )).rows[0]!.id;
    const roleA = (await pool.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id",
      [orgA, `CPCB-TEST-A-${suffix}`, JSON.stringify(["waste:record", "evidence:upload"])],
    )).rows[0]!.id;
    const roleB = (await pool.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id",
      [orgB, `CPCB-TEST-B-${suffix}`, JSON.stringify(["waste:record", "evidence:upload"])],
    )).rows[0]!.id;
    await pool.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$5,$6,'VERIFIED')",
      [identityA, orgA, roleA, identityB, orgB, roleB],
    );
    const tokenA = token(), tokenB = token();
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)",
      [identityA, hash(tokenA), identityB, hash(tokenB)],
    );

    const activityA = (await pool.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type) values($1,$2,$3,'CPCB_TEST') returning id",
      [orgA, identityA, geoA],
    )).rows[0]!.id;
    const activityB = (await pool.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type) values($1,$2,$3,'CPCB_TEST') returning id",
      [orgB, identityB, geoB],
    )).rows[0]!.id;
    const bytesA = Buffer.from("evidence-A");
    const bytesB = Buffer.from("evidence-B");
    const shaA = hash(bytesA.toString()), shaB = hash(bytesB.toString());
    const evidenceA = (await pool.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,captured_at,content_hash) values($1,'CPCB_SUPPORTING_DOCUMENT',now(),$2) returning id",
      [activityA, shaA],
    )).rows[0]!.id;
    const evidenceB = (await pool.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,captured_at,content_hash) values($1,'CPCB_SUPPORTING_DOCUMENT',now(),$2) returning id",
      [activityB, shaB],
    )).rows[0]!.id;
    const seriesA = (await pool.query<{id:string}>(
      "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,'CPCB_SUPPORTING_DOCUMENT',$3) returning id",
      [orgA, activityA, identityA],
    )).rows[0]!.id;
    const seriesB = (await pool.query<{id:string}>(
      "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,'CPCB_SUPPORTING_DOCUMENT',$3) returning id",
      [orgB, activityB, identityB],
    )).rows[0]!.id;
    await pool.query(
      "insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id) values($1,$2,1,'evidence-a.txt','text/plain',$3,$4,$5,$6),($7,$8,1,'evidence-b.txt','text/plain',$9,$10,$11,$12)",
      [seriesA, evidenceA, bytesA.length, shaA, bytesA, identityA, seriesB, evidenceB, bytesB.length, shaB, bytesB, identityB],
    );
    const workspaceA = (await pool.query<{id:string}>(
      "insert into cpcb_swm_stakeholder_workspaces(organization_id,geography_id,stakeholder_type,title,created_by_identity_id,updated_by_identity_id) values($1,$2,'ULB',$3,$4,$4) returning id",
      [orgA, geoA, `CPCB workspace A ${suffix}`, identityA],
    )).rows[0]!.id;

    server = spawn(process.execPath, ["dist/src/server.js"], {
      cwd: apiDir,
      env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATABASE_URL: databaseUrl, DATABASE_SSL: "false" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    server.stderr?.setEncoding("utf8");
    server.stderr?.on("data", (chunk: string) => { serverError += chunk; });
    try { await waitFor(`${baseUrl}/health`, server); }
    catch (error) { throw new Error(`${String(error)} ${serverError}`); }

    const checklistKey = initialSwmChecklist("ULB")[0]!.key;
    const linkPath = `/api/v1/cpcb-swm/workspaces/${workspaceA}/evidence`;
    const linked = await apiRequest(linkPath, tokenA, { method: "POST", body: JSON.stringify({ evidenceId: evidenceA, checklistKey }) });
    assert.equal(linked.status, 201);
    const linkedBody = await linked.json() as { evidenceLink: { evidenceStatus: string; officialCpcbStatus: string } };
    assert.equal(linkedBody.evidenceLink.officialCpcbStatus, "UNCHANGED");

    const listed = await apiRequest(linkPath, tokenA);
    assert.equal(listed.status, 200);
    const listedBody = await listed.json() as { evidenceLinks: Array<{ evidence_id: string }> };
    assert.equal(listedBody.evidenceLinks.length, 1);
    assert.equal(listedBody.evidenceLinks[0]!.evidence_id, evidenceA);

    const duplicate = await apiRequest(linkPath, tokenA, { method: "POST", body: JSON.stringify({ evidenceId: evidenceA, checklistKey }) });
    assert.equal(duplicate.status, 409);

    const invalidChecklist = await apiRequest(linkPath, tokenA, { method: "POST", body: JSON.stringify({ evidenceId: evidenceA, checklistKey: "invented_requirement" }) });
    assert.equal(invalidChecklist.status, 400);

    const otherOrgRead = await apiRequest(linkPath, tokenB);
    assert.equal(otherOrgRead.status, 404);
    const otherOrgWorkspaceWrite = await apiRequest(linkPath, tokenB, { method: "POST", body: JSON.stringify({ evidenceId: evidenceA, checklistKey }) });
    assert.equal(otherOrgWorkspaceWrite.status, 404);
    const crossOrgEvidence = await apiRequest(linkPath, tokenA, { method: "POST", body: JSON.stringify({ evidenceId: evidenceB, checklistKey }) });
    assert.equal(crossOrgEvidence.status, 404);

    const persisted = await pool.query<{count:string}>(
      "select count(*)::text as count from cpcb_swm_workspace_evidence where workspace_id=$1 and organization_id=$2",
      [workspaceA, orgA],
    );
    assert.equal(persisted.rows[0]!.count, "1");
  } finally {
    server?.kill("SIGTERM");
    await pool.end();
  }
});
