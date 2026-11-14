import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readBoundedResponseBody, ResponseBodyTooLargeError } from "./bounded-response.js";

test("bounded response reader returns text, byte count and SHA-256", async () => {
  const text = JSON.stringify({ status: "VERIFIED", id: "execution-1" });
  const result = await readBoundedResponseBody(new Response(text), 1024);
  assert.equal(result.text, text);
  assert.equal(result.bytes, Buffer.byteLength(text));
  assert.equal(result.sha256, createHash("sha256").update(text).digest("hex"));
});

test("bounded response reader rejects a declared oversized body before reading", async () => {
  const response = new Response("small", { headers: { "content-length": "2048" } });
  await assert.rejects(readBoundedResponseBody(response, 1024), ResponseBodyTooLargeError);
});

test("bounded response reader rejects an oversized streaming body", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
      controller.close();
    },
  });
  await assert.rejects(readBoundedResponseBody(new Response(stream), 1024), ResponseBodyTooLargeError);
});

test("bounded response reader rejects invalid size limits", async () => {
  await assert.rejects(readBoundedResponseBody(new Response("x"), 0), RangeError);
});
