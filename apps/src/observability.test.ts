import test from "node:test";
import assert from "node:assert/strict";
import { parseTraceparent } from "./observability.js";

test("accepts valid W3C traceparent", () => {
  const context = parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
  assert.deepEqual(context, {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    parentId: "00f067aa0ba902b7",
    sampled: true,
  });
});

test("rejects malformed or zero traceparent", () => {
  assert.equal(parseTraceparent("not-a-traceparent"), null);
  assert.equal(parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"), null);
  assert.equal(parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"), null);
});

test("preserves unsampled trace flag", () => {
  const context = parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00");
  assert.equal(context?.sampled, false);
});
