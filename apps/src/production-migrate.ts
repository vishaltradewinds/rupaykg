import { readProductionConfig } from "./production-config.js";

// The production migration runner must use the same fail-closed environment
// contract and TLS trust material as the production API process.
const config = readProductionConfig();

function requiredTarget(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PRODUCTION_MIGRATION_TARGET_INVALID: ${name} is required`);
  return value;
}

// These expected values are supplied by the protected release environment,
// not inferred from the connection string being checked.
process.env.RUPAYKG_EXPECTED_NEON_BRANCH_ID = requiredTarget("RUPAYKG_EXPECTED_NEON_BRANCH_ID");
process.env.RUPAYKG_EXPECTED_DATABASE_NAME = requiredTarget("RUPAYKG_EXPECTED_DATABASE_NAME");
process.env.RUPAYKG_EXPECTED_DATABASE_ROLE = requiredTarget("RUPAYKG_EXPECTED_DATABASE_ROLE");

process.env.DATABASE_URL = config.databaseUrl;
process.env.DATABASE_SSL = config.databaseSsl;
process.env.DATABASE_CA_CERT = config.databaseCaCert;

await import("./migrate.js");
