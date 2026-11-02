import { Client } from "pg";

const adminUrl = process.env.CI_ADMIN_DATABASE_URL;
if (!adminUrl) throw new Error("CI_ADMIN_DATABASE_URL is required to prepare the isolated migration-race database");

const database = "rupaykg_migration_race_test";
const client = new Client({ connectionString: adminUrl });
await client.connect();
try {
  const existing = await client.query("select datname from pg_database where datname = $1", [database]);
  if (existing.rows.length > 0) {
    throw new Error(`Refusing to reuse existing test database: ${database}`);
  }
  await client.query(`create database "${database}"`);
  console.log(`Created isolated integration database: ${database}`);
} finally {
  await client.end();
}
