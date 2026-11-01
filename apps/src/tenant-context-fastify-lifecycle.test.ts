import { AsyncLocalStorage } from "node:async_hooks";
import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";

type RequestContext = { requestId: string };
const pause = () => new Promise<void>((resolve) => setImmediate(resolve));

test("Fastify callback onRequest AsyncLocalStorage context reaches handler and response hooks", async () => {
  const storage = new AsyncLocalStorage<RequestContext>();
  const seenOnSend: Array<string | undefined> = [];
  const seenOnResponse: Array<string | undefined> = [];
  const app = Fastify();

  app.addHook("onRequest", (request, _reply, done) => {
    const requestId = request.url.slice(1);
    storage.run({ requestId }, () => done());
  });
  app.addHook("onSend", (_request, _reply, payload, done) => {
    seenOnSend.push(storage.getStore()?.requestId);
    done(null, payload);
  });
  app.addHook("onResponse", (_request, _reply, done) => {
    seenOnResponse.push(storage.getStore()?.requestId);
    done();
  });
  app.get("/:requestId", async (request) => {
    await pause();
    return { requestId: (request.params as { requestId: string }).requestId, contextId: storage.getStore()?.requestId ?? null };
  });

  try {
    const [a, b] = await Promise.all([
      app.inject({ method: "GET", url: "/tenant-a" }),
      app.inject({ method: "GET", url: "/tenant-b" }),
    ]);
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    assert.deepEqual(a.json(), { requestId: "tenant-a", contextId: "tenant-a" });
    assert.deepEqual(b.json(), { requestId: "tenant-b", contextId: "tenant-b" });
    assert.deepEqual(seenOnSend.sort(), ["tenant-a", "tenant-b"]);
    assert.deepEqual(seenOnResponse.sort(), ["tenant-a", "tenant-b"]);
  } finally {
    await app.close();
  }
});
