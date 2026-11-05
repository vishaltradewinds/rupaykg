const required = [
  "MIGRATOR_DATABASE_URL",
  "MIGRATOR_MODE",
  "NODE_ENV",
  "MIGRATOR_MANIFEST_PATH",
  "MIGRATOR_EXPECTED_DATABASE",
  "MIGRATOR_EXPECTED_USER",
  "DATABASE_SSL_CA_CERT",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Protected migrator configuration missing: ${missing.join(", ")}`);
if (process.env.MIGRATOR_MODE !== "true") throw new Error("MIGRATOR_MODE must be true");
if (process.env.NODE_ENV !== "production") throw new Error("NODE_ENV must be production");
if (process.env.DATABASE_URL) throw new Error("DATABASE_URL must not be supplied to the protected migrator job; use MIGRATOR_DATABASE_URL");
console.log("Protected migrator configuration contract: PASS");

const rehearsal = process.env.MIGRATOR_REHEARSAL === "true";
if (process.env.NODE_ENV === "production" && process.env.MIGRATOR_DATABASE_SSL_STRICT !== "true") {
  if (!rehearsal) throw new Error("Production protected migrations require MIGRATOR_DATABASE_SSL_STRICT=true");
  const parsed = new URL(process.env.MIGRATOR_DATABASE_URL);
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("MIGRATOR_REHEARSAL may only target localhost PostgreSQL");
  }
  if (process.env.MIGRATOR_EXPECTED_DATABASE !== "rupaykg" || process.env.MIGRATOR_EXPECTED_USER !== "postgres") {
    throw new Error("Local migration rehearsal must target the disposable rupaykg/postgres identity");
  }
}
