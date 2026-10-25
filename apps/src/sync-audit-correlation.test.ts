import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const routePath = fileURLToPath(new URL("../../../apps/src/sync-routes.ts", import.meta.url));
const migrationPath = fileURLToPath(new URL("../../../migrations/20261028_field_sync_conflict_request_correlation.sql", import.meta.url));
const mrvRoutePath = fileURLToPath(new URL("../../../apps/src/mrv-routes.ts", import.meta.url));

test("field-device audit events carry request correlation IDs", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(
    source,
    /insert into audit_events\([^)]*request_id[^)]*payload\) values\(\$1,\$2,'FIELD_DEVICE_ENROLLED','field_device',\$3,\$4,\$5\)/,
  );
  assert.match(
    source,
    /\[auth\.identityId, organizationId, device\.id, requestId, \{ deviceId: device\.device_id, identityId: device\.identity_id, status: device\.status \}\]/,
  );

  assert.match(
    source,
    /insert into audit_events\([^)]*request_id[^)]*payload\) values\(\$1,\$2,'FIELD_DEVICE_VERIFIED','field_device',\$3,\$4,\$5\)/,
  );
  assert.match(
    source,
    /\[auth\.identityId, row\.organization_id, deviceId, requestId, \{ deviceId: verifiedDevice\.device_id, identityId: verifiedDevice\.identity_id, status: verifiedDevice\.status \}\]/,
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
  assert.ok(
    route.indexOf("set_config('rupaykg.request_id'") < route.indexOf("update field_sync_conflicts"),
    "request correlation must be set before the database audit trigger fires",
  );
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
  assert.match(route, /applied\.organizationId, applied\.entityType, applied\.entityId, requestId/);
  assert.match(route, /payloadHash\(row\.payload\)/);
  assert.match(route, /update field_sync_envelopes set status = 'APPLIED'/);
  assert.match(route, /await client\.query\("COMMIT"\)/);
  assert.match(route, /await client\.query\("ROLLBACK"\)/);
});

test("field-sync intake and sequence conflicts are request-correlated", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /FIELD_SYNC_ENVELOPE_RECEIVED/);
  assert.match(source, /device\.organization_id, insertedRow\.id, requestId/);
  assert.match(source, /FIELD_SYNC_SEQUENCE_CONFLICT/);
  assert.match(source, /device\.organization_id, conflictRow\.id, requestId/);
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

test("all mutating field-device and field-sync routes fail closed without a request ID", async () => {
  const source = await readFile(routePath, "utf8");
  for (const routeName of [
    'app.post("/api/v1/field-devices/enroll"',
    'app.post("/api/v1/field-devices/:deviceId/verify"',
    'app.post("/api/v1/field-sync/envelopes"',
    'app.post("/api/v1/field-sync/envelopes/:envelopeId/apply"',
    'app.post("/api/v1/field-sync/conflicts/:conflictId/resolve"',
  ]) {
    const start = source.indexOf(routeName);
    assert.notEqual(start, -1, `route must exist: ${routeName}`);
    const end = source.indexOf("\n  });", start);
    assert.notEqual(end, -1, `route must terminate: ${routeName}`);
    const route = source.slice(start, end);
    assert.match(route, /requestIdOf\(request\)/);
    assert.match(route, /AUDIT_REQUEST_ID_REQUIRED/);
  }
});

test("MRV submission fails closed without request correlation before provider side effects", async () => {
  const source = await readFile(mrvRoutePath, "utf8");
  const routeStart = source.indexOf('app.post("/api/v1/mrv/activities/:activityId/submit"');
  assert.notEqual(routeStart, -1, "MRV submission route must exist");
  const routeEnd = source.indexOf("\n  });", routeStart);
  assert.notEqual(routeEnd, -1, "MRV submission route must terminate");
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /AUDIT_REQUEST_ID_REQUIRED/);
  assert.match(route, /requestId/);
  assert.ok(
    route.indexOf("AUDIT_REQUEST_ID_REQUIRED") < route.indexOf("executeGuardianMrv"),
    "request correlation must be validated before external Guardian/Hedera side effects",
  );
  assert.match(route, /MRV_PROVENANCE_PERSISTED/);
  assert.match(route, /provenance\.id, requestId/);
});
