import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generator = path.join(repoRoot, 'scripts', 'build-wa03-guardian-policy.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rupaykg-wa03-repro-'));
const epoch = '1743033600';
const expectedTimestamp = new Date(Number(epoch) * 1000).toISOString();

function snapshot(directory) {
  const result = [];
  function visit(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) visit(absolute, name);
      else result.push([name, crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')]);
    }
  }
  visit(directory);
  return result;
}

function runGenerator(cwd) {
  const result = spawnSync(process.execPath, [generator], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, SOURCE_DATE_EPOCH: epoch }
  });
  assert.equal(result.status, 0, `Generator failed:\n${result.stdout}\n${result.stderr}`);
}

function collectBlockIds(block, ids = []) {
  if (!block || typeof block !== 'object') return ids;
  if (typeof block.id === 'string') ids.push(block.id);
  for (const child of block.children ?? []) collectBlockIds(child, ids);
  return ids;
}

try {
  const outputRoot = path.join(tempRoot, 'guardian-policies', 'WA03.001');
  fs.mkdirSync(path.join(tempRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.copyFileSync(generator, path.join(tempRoot, 'scripts', 'build-wa03-guardian-policy.mjs'));

  runGenerator(tempRoot);
  const first = snapshot(outputRoot);
  const policy = JSON.parse(fs.readFileSync(path.join(outputRoot, 'policy.json'), 'utf8'));
  assert.equal(policy.updateDate, expectedTimestamp);
  const blockIds = collectBlockIds(policy.config);
  assert.ok(blockIds.length > 0, 'Expected generated policy blocks');
  assert.equal(new Set(blockIds).size, blockIds.length, 'Generated policy block IDs must be unique');

  for (const entry of fs.readdirSync(path.join(outputRoot, 'schemas')).filter(name => name.endsWith('.json'))) {
    const schema = JSON.parse(fs.readFileSync(path.join(outputRoot, 'schemas', entry), 'utf8'));
    assert.equal(schema.createDate, expectedTimestamp, `${entry}: createDate must use controlled timestamp`);
    assert.equal(schema.updateDate, expectedTimestamp, `${entry}: updateDate must use controlled timestamp`);
  }

  runGenerator(tempRoot);
  const second = snapshot(outputRoot);
  assert.deepEqual(second, first, 'Repeated generation with identical inputs must be byte-for-byte stable');
  console.log(`Guardian policy reproducibility passed: ${first.length} files; stable IDs, timestamps, and hashes.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
