import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCaptureContext, assertGeoCapture, assertMonotonicSequence } from './field-operations.js';

test('capture context requires identity, device, idempotency key and valid timestamp', () => {
  assert.doesNotThrow(() => assertCaptureContext({
    actorIdentityId: 'identity-1', deviceId: 'device-1', idempotencyKey: 'op-1', capturedAt: '2026-09-02T10:00:00Z'
  }));
  assert.throws(() => assertCaptureContext({
    actorIdentityId: '', deviceId: 'device-1', idempotencyKey: 'op-1', capturedAt: '2026-09-02T10:00:00Z'
  }));
});

test('geo capture validates latitude and longitude', () => {
  assert.doesNotThrow(() => assertGeoCapture({ latitude: 22.7196, longitude: 75.8577, accuracyMeters: 10 }));
  assert.throws(() => assertGeoCapture({ latitude: 91, longitude: 75 }));
  assert.throws(() => assertGeoCapture({ latitude: 22, longitude: -181 }));
});

test('offline operation sequence cannot move backwards', () => {
  assert.doesNotThrow(() => assertMonotonicSequence(4, 5));
  assert.doesNotThrow(() => assertMonotonicSequence(undefined, 1));
  assert.throws(() => assertMonotonicSequence(5, 5));
  assert.throws(() => assertMonotonicSequence(5, 4));
});
