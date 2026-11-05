import { spawn, execFileSync } from "node:child_process";

const url = process.env.MIGRATOR_DATABASE_URL;
if (!url) throw new Error("MIGRATOR_DATABASE_URL is required; refusing to use DATABASE_URL");
if (process.env.MIGRATOR_MODE !== "true") throw new Error("MIGRATOR_MODE=true is required");
if (process.env.NODE_ENV !== "production") throw new Error("NODE_ENV=production is required for the protected migrator job");
if (process.env.DATABASE_URL) throw new Error("DATABASE_URL must not be supplied to the protected migrator job");

execFileSync(process.execPath, ["scripts/validate-protected-migrator-config.mjs"], {
  stdio: "inherit",
  env: process.env,
});

execFileSync(process.execPath, ["scripts/validate-migration-manifest.mjs"], {
  stdio: "inherit",
  env: process.env,
});

const { MIGRATOR_DATABASE_URL: _migratorDatabaseUrl, ...childEnv } = process.env;

const child = spawn(process.execPath, ["apps/dist/src/migrate.js"], {
  stdio: "inherit",
  env: {
    ...childEnv,
    DATABASE_URL: url,
    DATABASE_SSL_STRICT: "true",
  },
});

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
