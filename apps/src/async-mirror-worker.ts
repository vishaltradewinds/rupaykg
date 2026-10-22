import type { Pool } from "pg";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";

export type GovernmentInboxValidation = {
  valid: boolean;
  state?: "UNRESOLVED";
  errorCode?: string;
  summary?: Record<string, unknown>;
};

export type GovernmentInboxValidator = (input: {
  id: string;
  authorityCode: string;
  municipalCode: string;
  batchId: string;
  payload: unknown;
}) => Promise<GovernmentInboxValidation>;

export type GovernmentInboxWorkerOptions = {
  batchSize?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
};

type ClaimedInboxRow = {
  id: string;
  authority_code: string;
  municipal_code: string;
  batch_id: string;
  sync_window_timestamp: Date | string;
  payload: unknown;
  payload_sha256: string;
  attempts: number;
  lease_token: string;
};

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_MAX_ATTEMPTS = 5;

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isInteger(value) && value! >= min && value! <= max ? value! : fallback;
}

/** Strict calendar/time validation; Date.parse alone normalizes some impossible dates. */
export function isValidSyncWindowTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  const zone = match[8], offsetHour = match[10], offsetMinute = match[11];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (zone !== "Z" && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

/**
 * Structural checks only. A successful result means the signed batch is
 * internally well-formed; it is not an official filing, verified MRV record,
 * carbon-credit decision, or government acceptance.
 */
export async function validateGovernmentInboxPayload(input: {
  authorityCode: string;
  municipalCode: string;
  batchId: string;
  payload: unknown;
}): Promise<GovernmentInboxValidation> {
  const fail = (errorCode: string): GovernmentInboxValidation => ({ valid: false, errorCode });
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);
  const payload = input.payload;
  if (!isRecord(payload) || !isRecord(payload.batchMetadata) || !Array.isArray(payload.rawDataLogs)) {
    return fail("BATCH_SCHEMA_INVALID");
  }
  if (Object.keys(payload).some((key) => !["batchMetadata", "rawDataLogs"].includes(key))) return fail("BATCH_UNKNOWN_FIELD");
  const metadata = payload.batchMetadata;
  if (Object.keys(metadata).some((key) => !["authorityCode", "municipalCode", "syncWindowTimestamp", "sourceVersion", "batchId"].includes(key))) {
    return fail("BATCH_METADATA_UNKNOWN_FIELD");
  }
  if (metadata.authorityCode !== input.authorityCode || metadata.municipalCode !== input.municipalCode || metadata.batchId !== input.batchId) {
    return fail("BATCH_DATABASE_METADATA_MISMATCH");
  }
  if (typeof metadata.sourceVersion !== "string" || !metadata.sourceVersion.trim() || metadata.sourceVersion.length > 120) {
    return fail("BATCH_SOURCE_VERSION_INVALID");
  }
  if (!isValidSyncWindowTimestamp(metadata.syncWindowTimestamp)) return fail("BATCH_TIMESTAMP_INVALID");
  if (payload.rawDataLogs.length < 1 || payload.rawDataLogs.length > 1000
    || !payload.rawDataLogs.every((entry) => typeof entry === "string" && entry.trim().length >= 5 && entry.length <= 20_000 && !entry.includes("\u0000"))) {
    return fail("BATCH_RECORDS_INVALID");
  }
  return {
    valid: true,
    summary: {
      validation: "STRUCTURAL_ONLY",
      schemaVersion: 1,
      recordCount: payload.rawDataLogs.length,
      authorityCode: input.authorityCode,
      municipalCode: input.municipalCode,
      officialAcceptance: false,
      authoritativeMrvMutation: false,
      guardianSubmission: false,
    },
  };
}

/**
 * Claims a bounded batch using PostgreSQL row locks and fencing tokens.
 * The validator must remain side-effect free: no MRV mutation or Guardian/Hedera submission.
 */
export async function runGovernmentInboxWorker(
  pool: Pool,
  validate: GovernmentInboxValidator = validateGovernmentInboxPayload,
  options: GovernmentInboxWorkerOptions = {},
): Promise<{ claimed: number; validated: number; rejected: number; unresolved: number; retried: number; quarantined: number }> {
  const batchSize = boundedInteger(options.batchSize, DEFAULT_BATCH_SIZE, 1, 100);
  const leaseSeconds = boundedInteger(options.leaseSeconds, DEFAULT_LEASE_SECONDS, 15, 900);
  const maxAttempts = boundedInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 20);

  await pool.query(
    `update async_mirror_inbox
        set status='QUARANTINED', quarantined_at=now(), lease_token=null, lease_until=null,
            last_error_code=coalesce(last_error_code, 'WORKER_ATTEMPTS_EXHAUSTED')
      where attempts >= $1
        and (
          status in ('RECEIVED','RETRY')
          or (status='PROCESSING' and (lease_until is null or lease_until < now()))
        )`,
    [maxAttempts],
  );

  const claimed = await pool.query<ClaimedInboxRow>(
    `with candidates as (
       select id
         from async_mirror_inbox
        where attempts < $3
          and (
            (status in ('RECEIVED','RETRY') and (next_attempt_at is null or next_attempt_at <= now()))
            or (status='PROCESSING' and lease_until < now())
          )
        order by received_at asc
        for update skip locked
        limit $1
     )
     update async_mirror_inbox inbox
        set status='PROCESSING', attempts=inbox.attempts+1,
            lease_token=gen_random_uuid(), lease_until=now() + ($2 * interval '1 second')
       from candidates
      where inbox.id=candidates.id
     returning inbox.id, inbox.authority_code, inbox.municipal_code, inbox.batch_id,
               inbox.sync_window_timestamp, inbox.payload, inbox.payload_sha256, inbox.attempts, inbox.lease_token`,
    [batchSize, leaseSeconds, maxAttempts],
  );

  const result = { claimed: claimed.rows.length, validated: 0, rejected: 0, unresolved: 0, retried: 0, quarantined: 0 };
  for (const row of claimed.rows) {
    try {
      let outcome: GovernmentInboxValidation;
      if (canonicalGovBridgeHash(row.payload) !== row.payload_sha256) {
        outcome = { valid: false, errorCode: "BATCH_PAYLOAD_HASH_MISMATCH" };
      } else {
        outcome = await validate({
          id: row.id,
          authorityCode: row.authority_code,
          municipalCode: row.municipal_code,
          batchId: row.batch_id,
          payload: row.payload,
        });
        if (outcome.valid) {
          const metadata = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
            ? (row.payload as Record<string, unknown>).batchMetadata
            : undefined;
          const syncWindowTimestamp = metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? (metadata as Record<string, unknown>).syncWindowTimestamp
            : undefined;
          const payloadTimestampMs = typeof syncWindowTimestamp === "string" ? Date.parse(syncWindowTimestamp) : Number.NaN;
          const databaseTimestampMs = row.sync_window_timestamp instanceof Date
            ? row.sync_window_timestamp.getTime()
            : Date.parse(row.sync_window_timestamp);
          if (!Number.isFinite(payloadTimestampMs) || !Number.isFinite(databaseTimestampMs) || payloadTimestampMs !== databaseTimestampMs) {
            outcome = { valid: false, errorCode: "BATCH_TIMESTAMP_DATABASE_MISMATCH" };
          }
        }
      }
      if (outcome.valid) {
        const mapped = await pool.query<{
          id: string; organization_id: string; geography_id: string; activity_id: string | null; source_version: string;
        }>(
          `select c.id,c.organization_id,c.geography_id,c.activity_id,c.source_version
             from government_jurisdiction_crosswalks c
             join authoritative_source_snapshots s on s.id=c.source_snapshot_id
               and s.validation_status='APPROVED'
            where c.authority_code=$1 and c.municipal_code=$2 and c.status='VERIFIED'
              and c.effective_from <= $3::timestamptz
              and (c.effective_to is null or c.effective_to > $3::timestamptz)
              and c.source_version = $4
              and organization_has_explicit_geography_scope(c.organization_id,c.geography_id)
              and (c.activity_id is null or exists (
                select 1 from activities a where a.id=c.activity_id
                  and a.organization_id=c.organization_id and a.geography_id=c.geography_id
              ))
            order by c.effective_from desc
            limit 2`,
          [row.authority_code, row.municipal_code, row.sync_window_timestamp, (row.payload as { batchMetadata?: { sourceVersion?: unknown } })?.batchMetadata?.sourceVersion],
        );
        if (mapped.rows.length !== 1) {
          outcome = {
            valid: false,
            state: "UNRESOLVED",
            errorCode: mapped.rows.length === 0 ? "GOVERNMENT_CROSSWALK_NOT_FOUND" : "GOVERNMENT_CROSSWALK_AMBIGUOUS",
            summary: {
              validation: "UNRESOLVED",
              reason: mapped.rows.length === 0 ? "NO_VERIFIED_JURISDICTION_CROSSWALK" : "MULTIPLE_VERIFIED_JURISDICTION_CROSSWALKS",
              authorityCode: row.authority_code,
              municipalCode: row.municipal_code,
              officialAcceptance: false,
              authoritativeMrvMutation: false,
              guardianSubmission: false,
            },
          };
        } else {
          const mapping = mapped.rows[0]!;
          outcome = {
            ...outcome,
            summary: {
              ...(outcome.summary ?? {}),
              validation: "STRUCTURAL_AND_JURISDICTION_CROSSWALK_RESOLVED",
              jurisdictionCrosswalk: {
                id: mapping.id,
                organizationId: mapping.organization_id,
                geographyId: mapping.geography_id,
                activityId: mapping.activity_id,
                sourceVersion: mapping.source_version,
              },
              domainBinding: "NOT_PERFORMED",
              officialAcceptance: false,
              authoritativeMrvMutation: false,
              guardianSubmission: false,
            },
          };
        }
      }
      if (outcome.valid) {
        const updated = await pool.query(
          `update async_mirror_inbox
              set status='VALIDATED', processed_at=now(), lease_token=null, lease_until=null,
                  next_attempt_at=null, last_error_code=null, validation_summary=$3::jsonb
            where id=$1 and status='PROCESSING' and lease_token=$2`,
          [row.id, row.lease_token, JSON.stringify(outcome.summary ?? {})],
        );
        if ((updated.rowCount ?? 0) === 1) result.validated += 1;
      } else if (outcome.state === "UNRESOLVED") {
        const updated = await pool.query(
          `update async_mirror_inbox
              set status='UNRESOLVED', processed_at=now(), lease_token=null, lease_until=null,
                  next_attempt_at=null, last_error_code=$3, validation_summary=$4::jsonb
            where id=$1 and status='PROCESSING' and lease_token=$2`,
          [row.id, row.lease_token, outcome.errorCode ?? "GOVERNMENT_CROSSWALK_UNRESOLVED", JSON.stringify(outcome.summary ?? {})],
        );
        if ((updated.rowCount ?? 0) === 1) result.unresolved += 1;
      } else {
        const code = (outcome.errorCode ?? "PAYLOAD_VALIDATION_REJECTED").replace(/[^A-Z0-9_.-]/gi, "_").slice(0, 100);
        const updated = await pool.query(
          `update async_mirror_inbox
              set status='REJECTED', processed_at=now(), lease_token=null, lease_until=null,
                  next_attempt_at=null, last_error_code=$3, validation_summary=$4::jsonb
            where id=$1 and status='PROCESSING' and lease_token=$2`,
          [row.id, row.lease_token, code, JSON.stringify(outcome.summary ?? {})],
        );
        if ((updated.rowCount ?? 0) === 1) result.rejected += 1;
      }
    } catch (error) {
      const exhausted = row.attempts >= maxAttempts;
      const code = error instanceof Error ? error.name.replace(/[^A-Z0-9_.-]/gi, "_").slice(0, 100) : "UNKNOWN_VALIDATION_ERROR";
      const delaySeconds = Math.min(60 * (2 ** Math.max(0, row.attempts - 1)), 3600);
      const updated = await pool.query(
        `update async_mirror_inbox
            set status=$3, lease_token=null, lease_until=null,
                next_attempt_at=case when $3='RETRY' then now() + ($4 * interval '1 second') else null end,
                quarantined_at=case when $3='QUARANTINED' then now() else null end,
                last_error_code=$5
          where id=$1 and status='PROCESSING' and lease_token=$2`,
        [row.id, row.lease_token, exhausted ? "QUARANTINED" : "RETRY", delaySeconds, code],
      );
      if ((updated.rowCount ?? 0) === 1) {
        if (exhausted) result.quarantined += 1;
        else result.retried += 1;
      }
    }
  }
  return result;
}

/** Read-only operational reconciliation; it does not change queue state. */
export async function reconcileGovernmentInbox(pool: Pool): Promise<{
  byStatus: Record<string, number>;
  expiredLeases: number;
  oldestUnresolvedAt: string | null;
}> {
  const summary = await pool.query<{ status: string; count: string; oldest_at: string | null }>(
    `select status, count(*)::text as count, min(received_at)::text as oldest_at
       from async_mirror_inbox
      where status not in ('VALIDATED','REJECTED')
      group by status`,
  );
  const leases = await pool.query<{ count: string }>(
    `select count(*)::text as count from async_mirror_inbox
      where status='PROCESSING' and lease_until < now()`,
  );
  const byStatus: Record<string, number> = {};
  let oldestUnresolvedAt: string | null = null;
  for (const row of summary.rows) {
    byStatus[row.status] = Number(row.count);
    if (row.oldest_at && (!oldestUnresolvedAt || row.oldest_at < oldestUnresolvedAt)) oldestUnresolvedAt = row.oldest_at;
  }
  return { byStatus, expiredLeases: Number(leases.rows[0]?.count ?? 0), oldestUnresolvedAt };
}
