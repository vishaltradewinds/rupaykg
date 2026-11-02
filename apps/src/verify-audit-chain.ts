import { Pool, type PoolConfig } from "pg";

type AnchorRow = {
  anchor_event_id: string;
  anchor_event_hash: string;
  legacy_anchor_event_id: string | null;
  legacy_anchor_event_hash: string | null;
  captured_at: string;
};
type HeadRow = { last_event_id: string | null; last_event_hash: string | null };
type ChainRow = {
  id: string;
  action: string;
  event_hash: string;
  previous_hash: string | null;
  expected_hash: string;
  depth: number;
  has_cycle: boolean;
};

function databaseConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required; this verifier never creates or migrates a database.");
  const config: PoolConfig = { connectionString, max: 1, connectionTimeoutMillis: 8000, statement_timeout: 15000 };
  if (process.env.DATABASE_SSL === "false") {
    config.ssl = false;
  } else {
    config.ssl = {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : {}),
    };
  }
  return config;
}

const pool = new Pool(databaseConfig());
const checks: { name: string; pass: boolean; detail: string }[] = [];

function check(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail });
}

try {
  const client = await pool.connect();
  try {
    await client.query("begin transaction isolation level repeatable read read only");

    const anchorResult = await client.query<AnchorRow>(
      "select anchor_event_id,anchor_event_hash,legacy_anchor_event_id,legacy_anchor_event_hash,captured_at from platform_audit_chain_anchor where singleton=true",
    );
    const headResult = await client.query<HeadRow>(
      "select last_event_id,last_event_hash from platform_audit_chain_head where singleton=true",
    );

    if (anchorResult.rowCount !== 1 || headResult.rowCount !== 1) {
      check("anchor_and_head_present", false, `anchor rows=${anchorResult.rowCount ?? 0}; head rows=${headResult.rowCount ?? 0}`);
      await client.query("rollback");
      console.log(JSON.stringify({ verifier: "rupaykg-read-only-audit-chain", status: "FAIL", mode: "READ_ONLY", checks }, null, 2));
      process.exitCode = 1;
    } else {
      const anchor = anchorResult.rows[0]!;
      const head = headResult.rows[0]!;
      check("anchor_and_head_present", true, "Exactly one immutable cutover anchor and one global chain head are present.");

      const chainResult = await client.query<ChainRow>(
        `with recursive chain as (
           select e.id,e.action,e.event_hash,e.previous_hash,1::integer as depth,array[e.event_hash]::text[] as path,
                  false as has_cycle
             from audit_events e where e.id=$1
           union all
           select e.id,e.action,e.event_hash,e.previous_hash,c.depth+1,c.path||e.event_hash,
                  e.event_hash=any(c.path) as has_cycle
             from audit_events e join chain c on e.previous_hash=c.event_hash
            where not c.has_cycle and c.depth < 1000000
         )
         select c.id,c.action,c.event_hash,c.previous_hash,c.depth,c.has_cycle,
                encode(digest(convert_to(jsonb_build_object(
                  'id',e.id,'actor_identity_id',e.actor_identity_id,'organization_id',e.organization_id,
                  'action',e.action,'target_type',e.target_type,'target_id',e.target_id,
                  'request_id',e.request_id,'payload',e.payload,
                  'created_at',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                  'previous_hash',e.previous_hash
                )::text,'UTF8'),'sha256'),'hex') as expected_hash
           from chain c join audit_events e on e.id=c.id
          order by c.depth,c.id`,
        [anchor.anchor_event_id],
      );

      const chain = chainResult.rows;
      const anchorEvent = chain.find(row => row.id === anchor.anchor_event_id);
      check("anchor_event_matches_record", !!anchorEvent && anchorEvent.event_hash === anchor.anchor_event_hash && anchorEvent.action === "AUDIT_CHAIN_CUTOVER_ANCHOR",
        anchorEvent ? `anchor event action=${anchorEvent.action}; hash matches=${anchorEvent.event_hash === anchor.anchor_event_hash}` : "Anchor event is missing from audit_events.");
      check("canonical_sha256", chain.length > 0 && chain.every(row => row.event_hash === row.expected_hash),
        `${chain.filter(row => row.event_hash !== row.expected_hash).length} of ${chain.length} reachable events have hash mismatches.`);
      check("no_cycle", !chain.some(row => row.has_cycle), chain.some(row => row.has_cycle) ? "A cycle was detected." : "No cycle detected in the traversed chain.");
      const successors = new Map<string, number>();
      for (const row of chain) {
        if (row.previous_hash !== null) successors.set(row.previous_hash, (successors.get(row.previous_hash) ?? 0) + 1);
      }
      const forks = [...successors.values()].filter(count => count > 1).length;
      check("no_forks", forks === 0, `${forks} predecessor hash(es) have multiple reachable successors.`);

      const reachedHead = chain.some(row => row.id === head.last_event_id && row.event_hash === head.last_event_hash);
      const headEventResult = head.last_event_id
        ? await client.query<{ event_hash: string }>("select event_hash from audit_events where id=$1", [head.last_event_id])
        : { rowCount: 0, rows: [] as { event_hash: string }[] };
      check("head_reachable_and_consistent", !!head.last_event_id && !!head.last_event_hash && reachedHead && headEventResult.rows[0]?.event_hash === head.last_event_hash,
        `head id present=${!!head.last_event_id}; referenced event hash matches=${headEventResult.rows[0]?.event_hash === head.last_event_hash}; reachable from anchor=${reachedHead}`);

      const legacyPairValid = (anchor.legacy_anchor_event_id === null && anchor.legacy_anchor_event_hash === null) ||
        (anchor.legacy_anchor_event_id !== null && anchor.legacy_anchor_event_hash !== null);
      let legacyPointerMatches = legacyPairValid;
      if (anchor.legacy_anchor_event_id && anchor.legacy_anchor_event_hash) {
        const legacy = await client.query<{ event_hash: string }>("select event_hash from audit_events where id=$1", [anchor.legacy_anchor_event_id]);
        legacyPointerMatches = legacy.rows[0]?.event_hash === anchor.legacy_anchor_event_hash && anchorEvent?.previous_hash === anchor.legacy_anchor_event_hash;
      } else {
        legacyPointerMatches = anchorEvent?.previous_hash === null;
      }
      check("legacy_cutover_pointer_consistent", legacyPointerMatches,
        legacyPointerMatches ? "Cutover event predecessor agrees with the immutable legacy pointer." : "Cutover predecessor and immutable legacy pointer disagree.");

      const unlinked = await client.query<{ count: string }>(
        `with recursive chain as (
           select id,event_hash,created_at,1::integer as depth,array[event_hash]::text[] as path
             from audit_events where id=$1
           union all
           select e.id,e.event_hash,e.created_at,c.depth+1,c.path||e.event_hash
             from audit_events e join chain c on e.previous_hash=c.event_hash
            where not e.event_hash=any(c.path) and c.depth < 1000000
         )
         select count(*)::text as count from audit_events e
          where e.created_at >= (select created_at from audit_events where id=$1)
            and not exists(select 1 from chain c where c.id=e.id)`,
        [anchor.anchor_event_id],
      );
      const unlinkedCount = Number(unlinked.rows[0]?.count ?? 0);
      check("no_unlinked_events_since_anchor_timestamp", unlinkedCount === 0,
        unlinkedCount === 0
          ? "No event timestamped at or after the cutover anchor is outside the traversed chain."
          : `${unlinkedCount} event(s) timestamped at or after the cutover anchor are not reachable. This is a conservative anomaly check; inspect timestamp anomalies and legacy records before concluding tampering.`);

      await client.query("commit");
      const failed = checks.filter(item => !item.pass);
      const status = failed.length === 0 ? "PASS" : "FAIL";
      console.log(JSON.stringify({
        verifier: "rupaykg-read-only-audit-chain",
        status,
        mode: "READ_ONLY",
        snapshot: "REPEATABLE READ",
        anchorEventId: anchor.anchor_event_id,
        anchorCapturedAt: anchor.captured_at,
        headEventId: head.last_event_id,
        reachableEventsFromAnchor: chain.length,
        checks,
        historicalLimitation: "Rows before the migration-088 cutover anchor are preserved but are not retroactively certified by this verifier.",
      }, null, 2));
      if (failed.length) process.exitCode = 1;
    }
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(JSON.stringify({
    verifier: "rupaykg-read-only-audit-chain",
    status: "ERROR",
    mode: "READ_ONLY",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await pool.end();
}
