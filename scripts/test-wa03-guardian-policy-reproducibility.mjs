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
  const expectedCanonicalIds = [
    'ee4fb9cf-947b-474a-a9b0-b3cd7dbeace2',
    'f88bbf83-1f85-4f52-982a-a3ef577d1dc7',
    '0df9a0ce-7b94-4494-81dd-fc4669b38db5',
    'a0230842-f33c-4ca9-a499-f44bcb92460c',
    '2302bf51-71f7-440e-ba59-7b3691f8ddbd',
    'c9afb072-9781-4626-9b75-1cd7bce73d1b',
    '7207cc7b-552a-4e45-9e69-6d15259160c5',
    'aa7d80c7-49de-4bde-9b65-e5af7dc80dd5',
    'fcb9c262-c881-4dc0-8ab0-aa98de2c631f',
    '8ed947fa-dd87-48b8-809a-21dd3b43556b'
  ].sort();
  assert.deepEqual([...blockIds].sort(), expectedCanonicalIds, 'Generated policy must preserve reviewed canonical block IDs');

  for (const entry of fs.readdirSync(path.join(outputRoot, 'schemas')).filter(name => name.endsWith('.json'))) {
    const schema = JSON.parse(fs.readFileSync(path.join(outputRoot, 'schemas', entry), 'utf8'));
    assert.equal(schema.createDate, expectedTimestamp, `${entry}: createDate must use controlled timestamp`);
    assert.equal(schema.updateDate, expectedTimestamp, `${entry}: updateDate must use controlled timestamp`);
  }

  runGenerator(tempRoot);
  const second = snapshot(outputRoot);
  assert.deepEqual(second, first, 'Repeated generation with identical inputs must be byte-for-byte stable');

  // Build a deterministic ZIP package with normalized timestamps and file modes.
  const packageScript = String.raw`
import hashlib, os, pathlib, sys, zipfile
source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
epoch = int(sys.argv[3])
import datetime
stamp = datetime.datetime.fromtimestamp(epoch, datetime.timezone.utc)
stamp = (max(stamp.year, 1980), stamp.month, stamp.day, stamp.hour, stamp.minute, stamp.second // 2 * 2)
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(p for p in source.rglob('*') if p.is_file()):
        name = path.relative_to(source).as_posix()
        info = zipfile.ZipInfo(name, date_time=stamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
with zipfile.ZipFile(target) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit('Corrupt archive member: ' + bad)
    if 'policy.json' not in archive.namelist():
        raise SystemExit('Packaged policy.json missing')
    if not any(name.startswith('schemas/') and name.endswith('.json') for name in archive.namelist()):
        raise SystemExit('Packaged schema JSON missing')
print(hashlib.sha256(target.read_bytes()).hexdigest())
`;
  const zipOne = path.join(tempRoot, 'guardian-policy-one.zip');
  const zipTwo = path.join(tempRoot, 'guardian-policy-two.zip');
  function packageGenerated(target) {
    const result = spawnSync('python3', ['-c', packageScript, outputRoot, target, epoch], { encoding: 'utf8' });
    assert.equal(result.status, 0, `Package validation failed:\n${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  }
  const packageHashOne = packageGenerated(zipOne);
  const packageHashTwo = packageGenerated(zipTwo);
  assert.match(packageHashOne, /^[a-f0-9]{64}$/);
  assert.equal(packageHashTwo, packageHashOne, 'Identical generated sources must produce identical package hashes');
  console.log(`Guardian policy reproducibility passed: ${first.length} files; stable IDs, timestamps, source hashes, and validated package SHA-256 ${packageHashOne}.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
