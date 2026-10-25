import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const routePath = fileURLToPath(new URL("./sync-routes.ts", import.meta.url));

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
