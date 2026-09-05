import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";

const appRoot = resolve(new URL("..", import.meta.url).pathname);
const serverPath = resolve(appRoot, "dist/src/server.js");
const port = 39127;

type HttpOptionsResult = {
  headers: Record<string, string | string[] | undefined>;
  statusCode?: number;
};

function httpOptions(origin: string): Promise<HttpOptionsResult> {
  return new Promise((resolveRequest, reject) => {
    const req = request({
      hostname: "127.0.0.1",
      port,
      path: "/health",
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    }, (res) => {
      res.resume();
      res.on("end", () => {
        const result: HttpOptionsResult = { headers: res.headers };
        if (res.statusCode !== undefined) result.statusCode = res.statusCode;
        resolveRequest(result);
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await httpOptions("https://app.rupaykg.example");
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  throw new Error("CORS runtime server did not become reachable");
}

test("Fastify CORS enforces the configured origin allowlist", async () => {
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATABASE_SSL: "false",
      PORT: String(port),
      RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example,https://admin.rupaykg.example",
    },
    stdio: "ignore",
  });

  try {
    await waitForServer();

    const allowed = await httpOptions("https://app.rupaykg.example");
    assert.equal(allowed.headers["access-control-allow-origin"], "https://app.rupaykg.example");

    const denied = await httpOptions("https://evil.example");
    assert.equal(denied.headers["access-control-allow-origin"], undefined);
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((resolveExit) => {
      if (child.exitCode !== null) return resolveExit();
      child.once("exit", () => resolveExit());
    });
  }
});
