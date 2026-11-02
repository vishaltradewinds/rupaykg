import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerMrvRoutes } from "./mrv-routes.js";

type EnvValues = Record<string, string | undefined>;

async function withEnvironment(values: EnvValues, run: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function databaseSpy(): { pool: Pool; calls: () => number } {
  let count = 0;
  const touch = async () => {
    count += 1;
    throw new Error("database must not be accessed by a disabled synchronous MRV route");
  };
  return {
    pool: { query: touch, connect: touch } as unknown as Pool,
    calls: () => count,
  };
}

async function setup(pool: Pool) {
  const app = Fastify();
  await registerMrvRoutes(app, pool);
  await app.ready();
  return app;
}

test("synchronous MRV submit is disabled by default before authentication or database access", async () => {
  await withEnvironment({
    RUPAYKG_MRV_DIRECT_SUBMIT_ENABLED: undefined,
    RUPAYKG_MRV_WORKER_ENABLED: undefined,
  }, async () => {
    const db = databaseSpy();
    const app = await setup(db.pool);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/mrv/activities/activity-1/submit",
        payload: {},
      });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "MRV_DIRECT_SUBMIT_DISABLED");
      assert.equal(db.calls(), 0, "disabled synchronous submission must not authenticate or touch PostgreSQL");
    } finally {
      await app.close();
    }
  });
});

test("synchronous MRV submit remains disabled when the durable worker is enabled", async () => {
  await withEnvironment({
    RUPAYKG_MRV_DIRECT_SUBMIT_ENABLED: "true",
    RUPAYKG_MRV_WORKER_ENABLED: "true",
  }, async () => {
    const db = databaseSpy();
    const app = await setup(db.pool);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/mrv/activities/activity-1/submit",
        payload: {},
      });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "MRV_DIRECT_SUBMIT_DISABLED");
      assert.equal(db.calls(), 0, "direct and durable provider execution paths must never run together");
    } finally {
      await app.close();
    }
  });
});
