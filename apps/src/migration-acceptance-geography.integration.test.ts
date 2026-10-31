import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

test("credential database guard rejects acceptance-fixture geography even when activity and evidence are not fixtures", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const migrationCandidates = [
    path.resolve(sourceDir, "../../migrations/108_acceptance_geography_registry_exclusion.sql"),
    path.resolve(sourceDir, "../../../migrations/108_acceptance_geography_registry_exclusion.sql"),
  ];
  let migrationSql: string | undefined;
  for (const candidate of migrationCandidates) {
    try {
      migrationSql = await readFile(candidate, "utf8");
      break;
    } catch {
      // Try the source-tree or compiled-container layout.
    }
  }
  assert.ok(migrationSql, "Could not locate migration 108 in the repository tree");

  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const dbName = `rupaykg_acceptance_geo_guard_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "rupaykg-acceptance-geography-"));
  const geographyId = "00000000-0000-4000-8000-000000000108";
  const activityId = "00000000-0000-4000-8000-000000000109";

  try {
    await writeFile(path.join(fixtureDir, "001_acceptance_geography_registry_exclusion.sql"), migrationSql!, "utf8");
    await adminPool.query(`CREATE DATABASE "${dbName}"`);

    const seedPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      await seedPool.query(`
        CREATE TABLE geography (
          id uuid PRIMARY KEY,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE TABLE activities (
          id uuid PRIMARY KEY,
          geography_id uuid NOT NULL REFERENCES geography(id),
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE TABLE evidence (
          id uuid PRIMARY KEY,
          activity_id uuid NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE TABLE verifications (
          id uuid PRIMARY KEY,
          evidence_id uuid,
          activity_id uuid,
          decision text
        );
        CREATE TABLE credentials (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          status text NOT NULL,
          activity_id uuid NOT NULL,
          verification_id uuid,
          methodology_version_id uuid
        )
      `);
      await seedPool.query(
        "INSERT INTO geography(id, metadata) VALUES ($1, $2::jsonb)",
        [geographyId, JSON.stringify({ acceptanceFixture: true, nonLgd: true })],
      );
      await seedPool.query(
        "INSERT INTO activities(id, geography_id, metadata) VALUES ($1, $2, '{}'::jsonb)",
        [activityId, geographyId],
      );
    } finally {
      await seedPool.end();
    }

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testUrl.toString(),
        RUPAYKG_RUN_DB_INTEGRATION_TESTS: "1",
        RUPAYKG_TEST_MIGRATION_DIR: fixtureDir,
      },
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, "migration runner process should start and finish normally");
    assert.equal(child.status, 0, `migration 108 should apply to the disposable fixture database: ${child.stderr}`);

    const verifyPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      await assert.rejects(
        verifyPool.query(
          "INSERT INTO credentials(status, activity_id, verification_id, methodology_version_id) VALUES ('ISSUED', $1, $2, $3)",
          [activityId, "00000000-0000-4000-8000-000000000110", "00000000-0000-4000-8000-000000000111"],
        ),
        /ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE: acceptance fixture geography cannot back an issued registry credential/,
      );
      const rows = await verifyPool.query<{ count: string }>("SELECT count(*)::text AS count FROM credentials");
      assert.equal(rows.rows[0]?.count, "0", "rejected credential must not be persisted");
    } finally {
      await verifyPool.end();
    }
  } finally {
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminPool.end();
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
