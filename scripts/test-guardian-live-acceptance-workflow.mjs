import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = '.github/workflows/guardian-live-acceptance.yml';
const workflow = fs.readFileSync(path, 'utf8');
const step = name => {
  const marker = `      - name: ${name}`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing acceptance step: ${name}`);
  const next = workflow.indexOf('\n      - name:', start + marker.length);
  return workflow.slice(start, next === -1 ? workflow.length : next);
};
const validateInputs = step('Validate acceptance inputs');
const submission = step('Submit authoritative MRV');
const persisted = step('Verify persisted provenance');
const mirror = step('Verify Hedera provenance through Mirror Node');
const finalState = step('Re-check persisted registry eligibility');
assert.ok(validateInputs.includes('parsed.hostname != "rupaykg.onrender.com"'),
  'Live acceptance must never send the session secret to an arbitrary HTTPS host');
assert.ok(validateInputs.includes('uuid_pattern.fullmatch'),
  'Organization/activity/verification/evidence identifiers must be validated as UUIDs');
assert.ok(validateInputs.includes('POLICY_ID must be a 1-200 character policy identifier'),
  'Guardian policy identifier must reject whitespace and path characters');
assert.ok(!submission.includes('cat /tmp/mrv-submit.json'),
  'Failed submissions must not print the full operational response body into CI logs');
assert.ok(submission.includes('if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then'),
  'Fresh submissions (201) and idempotent replays (200) must both be accepted'); 
assert.ok(submission.includes('HTTP 201 is a fresh successful submission; HTTP 200 is an idempotent replay.'),
  'The workflow must explicitly document the distinction between fresh submissions and idempotent replays');
assert.ok(submission.includes('replay must not create a duplicate transaction.'),
  'Idempotent replay must not create a duplicate transaction');
assert.ok(submission.indexOf('if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then') < submission.indexOf("guardian.get('status') != 'VERIFIED'"),
  'Both accepted HTTP statuses must proceed through the same strict Guardian/Hedera/provenance validation');

assert.ok(submission.includes("guardian.get('status') != 'VERIFIED'"));
assert.ok(submission.includes("hedera.get('status') != 'CONSENSUS_CONFIRMED'"));
assert.ok(!submission.includes("Submission did not become registry-eligible"),
  'Submission must not require registry eligibility before Mirror Node verification');
assert.ok(submission.includes("provenance.get(field) != expected"),
  'Submission must bind persisted provenance to the exact activity/verification/evidence/policy inputs');
assert.ok(submission.includes('import json, os'),
  'Submission step must import os before reading acceptance identifiers from environment variables');
assert.ok(submission.includes("timestamp + chr(10)"),
  'Consensus timestamp env file must use a real newline before the next step sources it');
assert.ok(persisted.includes("r.get('activity_id') == os.environ['ACTIVITY_ID']"));
assert.ok(persisted.includes("r.get('verification_id') == os.environ['VERIFICATION_ID']"));
assert.ok(persisted.includes("r.get('evidence_id') == os.environ['EVIDENCE_ID']"));
assert.ok(persisted.includes("r.get('guardian_policy_id') == os.environ['POLICY_ID']"));
assert.ok(mirror.includes("data.get('verified') is not True"));
assert.ok(mirror.includes("data.get('eligibleForRegistry') is not True"),
  'Mirror Node verification must confirm eligibility only after external verification');
assert.ok(finalState.includes("data.get('eligibleForRegistry') is not True"),
  'Final persisted provenance must independently confirm registry eligibility');
assert.ok(finalState.includes("r.get('mirror_node_verified_at')"),
  'Final persisted provenance must contain the Mirror Node verification timestamp');

const ordered = [
  'Submit authoritative MRV',
  'Verify persisted provenance',
  'Verify Hedera provenance through Mirror Node',
  'Re-check persisted registry eligibility',
  'Acceptance result',
].map(name => workflow.indexOf(`      - name: ${name}`));
assert.ok(ordered.every((position, i) => position >= 0 && (i === 0 || position > ordered[i - 1])),
  'Live acceptance gates must run in the required order');

console.log('Guardian live-acceptance workflow regression checks passed.');
