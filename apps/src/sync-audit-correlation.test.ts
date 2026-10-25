import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const routePath = fileURLToPath(new URL("../../../apps/src/sync-routes.ts", import.meta.url));

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
  assert.match(route, /insert into audit_events[\s\S]*?request_id[\s\S]*?FIELD_SYNC_CONFLICT_RESOLVED/);
  assert.match(route, /\[auth\.identityId, conflict\.organization_id, conflictId, request\.id,/);
  assert.match(route, /await client\.query\("COMMIT"\)/);
  assert.match(route, /await client\.query\("ROLLBACK"\)/);
});
