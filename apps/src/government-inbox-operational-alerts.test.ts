import test from "node:test";
import assert from "node:assert/strict";
import { deliverOperationalAlert, readOperationalAlertWebhookUrl } from "./government-inbox-operational-alerts.js";

test("alert webhook configuration fails closed for non-HTTPS or credential-bearing URLs", () => {
  assert.equal(readOperationalAlertWebhookUrl(undefined), null);
  assert.throws(() => readOperationalAlertWebhookUrl("http://monitor.example/alert"), /HTTPS/);
  assert.throws(() => readOperationalAlertWebhookUrl("https://user:secret@monitor.example/alert"), /userinfo/);
  assert.throws(() => readOperationalAlertWebhookUrl("https://monitor.example/alert#secret"), /fragment/);
  assert.equal(readOperationalAlertWebhookUrl("https://monitor.example/alert"), "https://monitor.example/alert");
});

test("alert webhook sends only bounded operational metadata and treats non-2xx as failure", async () => {
  const captured: { url: string; body?: Record<string, unknown> } = { url: "" };
  const result = await deliverOperationalAlert("https://monitor.example/alert", "attention_required", {
    quarantined: 2,
    expiredLeases: 1,
  }, async (input, init) => {
    captured.url = String(input);
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("", { status: 202 });
  });
  assert.equal(captured.url, "https://monitor.example/alert");
  assert.equal(result.delivered, true);
  assert.equal(result.statusCode, 202);
  assert.equal(captured.body?.event, "attention_required");
  assert.equal(captured.body?.officialGovernmentSubmission, false);
  assert.deepEqual(captured.body?.details, { quarantined: 2, expiredLeases: 1 });
  assert.equal(JSON.stringify(captured.body).includes("payload"), false);

  const rejected = await deliverOperationalAlert("https://monitor.example/alert", "tick_failed", {}, async () => new Response("", { status: 503 }));
  assert.equal(rejected.delivered, false);
  assert.equal(rejected.statusCode, 503);
  assert.equal(rejected.errorClass, "WEBHOOK_HTTP_ERROR");
});

test("alert webhook delivery errors do not expose endpoint or request content", async () => {
  const result = await deliverOperationalAlert("https://monitor.example/secret-path", "tick_failed", { error: "DatabaseError" }, async () => {
    throw new Error("network failure");
  });
  assert.deepEqual(result, { delivered: false, statusCode: null, errorClass: "Error" });
});
