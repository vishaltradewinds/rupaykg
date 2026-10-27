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
const submission = step('Submit authoritative MRV');
const persisted = step('Verify persisted provenance');
const mirror = step('Verify Hedera provenance through Mirror Node');
const finalState = step('Re-check persisted registry eligibility');

assert.ok(submission.includes("guardian.get('status') != 'VERIFIED'"));
assert.ok(submission.includes("hedera.get('status') != 'CONSENSUS_CONFIRMED'"));
assert.ok(!submission.includes("Submission did not become registry-eligible"),
  'Submission must not require registry eligibility before Mirror Node verification');
assert.ok(submission.includes("provenance.get(field) != expected"),
  'Submission must bind persisted provenance to the exact activity/verification/evidence/policy inputs');
assert.ok(submission.includes('import json, os'),
  'Submission step must import os before reading acceptance identifiers from environment variables');
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
