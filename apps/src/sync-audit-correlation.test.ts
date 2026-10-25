import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const routePath = fileURLToPath(new URL("../../../apps/src/sync-routes.ts", import.meta.url));
const migrationPath = fileURLToPath(new URL("../../../migrations/20261028_field_sync_conflict_request_correlation.sql", import.meta.url));

test("field-device audit events carry request correlation IDs", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(
    source,
    /insert into audit_events\([^)]*request_id[^)]*payload\) values\(\$1,\$2,'FIELD_DEVICE_ENROLLED','field_device',\$3,\$4,\$5\)/,
  );
  assert.match(
    source,
    /\[auth\.identityId, organizationId, device\.id, request\.id, \{ deviceId: device\.device_id, identityId: device\.identity_id, status: device\.status \}\]/,
  );

  assert.match(
    source,
    /insert into audit_events\([^)]*request_id[^)]*payload\) values\(\$1,\$2,'FIELD_DEVICE_VERIFIED','field_device',\$3,\$4,\$5\)/,
  );
  assert.match(
    source,
    /\[auth\.identityId, row\.organization_id, deviceId, request\.id, \{ deviceId: verifiedDevice\.device_id, identityId: verifiedDevice\.identity_id, status: verifiedDevice\.status \}\]/,
  );
});

test("field-sync conflict resolution is atomic and request-correlated", async () => {
  const source = await readFile(routePath, "utf8");
  const routeStart = source.indexOf('app.post("/api/v1/field-sync/conflicts/:conflictId/resolve"');
  assert.notEqual(routeStart, -1, "conflict-resolution route must exist");
  const routeEnd = source.indexOf("\n  });", routeStart);
  assert.notEqual(routeEnd, -1, "conflict-resolution route must terminate");
  const route = source.slice(routeStart, routeEnd);

  assert.match(route, /await client\.query\("BEGIN"\)/);
  assert.match(route, /for update of c/);
  assert.match(route, /update field_sync_conflicts/);
  assert.match(route, /set_config\('rupaykg\.request_id', \$1, true\)/);
  assert.doesNotMatch(route, /insert into audit_events/, "database trigger must remain the sole audit-event writer");
  assert.match(route, /await client\.query\("COMMIT"\)/);
  assert.match(route, /await client\.query\("ROLLBACK"\)/);

  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /request_id,[\s\S]*?event_hash/);
  assert.match(migration, /nullif\(current_setting\('rupaykg\.request_id', true\), ''\)/);
  assert.match(migration, /FIELD_SYNC_CONFLICT_RESOLVED/);
});

test("authoritative field-sync application is request-correlated and atomic", async () => {
  const source = await readFile(routePath, "utf8");
  const routeStart = source.indexOf('app.post("/api/v1/field-sync/envelopes/:envelopeId/apply"');
  assert.notEqual(routeStart, -1, "envelope-application route must exist");
  const routeEnd = source.indexOf("\n  });", routeStart);
  assert.notEqual(routeEnd, -1, "envelope-application route must terminate");
  const route = source.slice(routeStart, routeEnd);

  assert.match(route, /await client\.query\("BEGIN"\)/);
  assert.match(route, /const applied = await applyOperation\(client, auth, row\.payload\)/);
  assert.match(route, /FIELD_SYNC_OPERATION_APPLIED/);
  assert.match(route, /applied\.organizationId, applied\.entityType, applied\.entityId, request\.id/);
  assert.match(route, /payloadHash\(row\.payload\)/);
  assert.match(route, /update field_sync_envelopes set status = 'APPLIED'/);
  assert.match(route, /await client\.query\("COMMIT"\)/);
  assert.match(route, /await client\.query\("ROLLBACK"\)/);
});

test("field-sync intake and sequence conflicts are request-correlated", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /FIELD_SYNC_ENVELOPE_RECEIVED/);
  assert.match(source, /device\.organization_id, insertedRow\.id, request\.id/);
  assert.match(source, /FIELD_SYNC_SEQUENCE_CONFLICT/);
  assert.match(source, /device\.organization_id, conflictRow\.id, request\.id/);
  assert.match(source, /payloadHash: hash/);
  assert.match(source, /organization_id is not null/);
  const intakeStart = source.indexOf('app.post("/api/v1/field-sync/envelopes"');
  const intakeEnd = source.indexOf('app.post("/api/v1/field-sync/envelopes/:envelopeId/apply"');
  assert.ok(intakeStart >= 0 && intakeEnd > intakeStart, "intake route must exist");
  const intake = source.slice(intakeStart, intakeEnd);
  assert.match(intake, /await client\.query\("BEGIN"\)/);
  assert.match(intake, /FIELD_SYNC_ENVELOPE_RECEIVED/);
  assert.match(intake, /FIELD_SYNC_SEQUENCE_CONFLICT/);
  assert.match(intake, /await client\.query\("COMMIT"\)/);
  assert.match(intake, /await client\.query\("ROLLBACK"\)/);
});
