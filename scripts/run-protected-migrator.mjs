import { spawn } from "node:child_process";

const url = process.env.MIGRATOR_DATABASE_URL;
if (!url) {
  throw new Error("MIGRATOR_DATABASE_URL is required; refusing to use DATABASE_URL");
}
if (process.env.MIGRATOR_MODE !== "true") {
  throw new Error("MIGRATOR_MODE=true is required");
}
if (process.env.NODE_ENV !== "production") {
  throw new Error("NODE_ENV=production is required for the protected migrator");
}

const child = spawn(process.execPath, ["apps/dist/src/migrate.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: url,
    MIGRATOR_DATABASE_URL: undefined,
  },
});

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
