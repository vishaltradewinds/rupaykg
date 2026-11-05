const required = ["MIGRATOR_DATABASE_URL", "MIGRATOR_MODE", "NODE_ENV"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  throw new Error(`Protected migrator configuration missing: ${missing.join(", ")}`);
}
if (process.env.MIGRATOR_MODE !== "true") {
  throw new Error("MIGRATOR_MODE must be true");
}
if (process.env.NODE_ENV !== "production") {
  throw new Error("NODE_ENV must be production");
}

if (process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must not be supplied to the protected migrator job; use MIGRATOR_DATABASE_URL");
}

console.log("Protected migrator configuration contract: PASS");
