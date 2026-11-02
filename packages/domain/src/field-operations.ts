export interface CaptureContext {
  actorIdentityId: string;
  deviceId: string;
  capturedAt: string;
  idempotencyKey: string;
  sequence?: number;
}

export interface GeoCapture {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface SyncEnvelope<TPayload> {
  idempotencyKey: string;
  actorIdentityId: string;
  deviceId: string;
  capturedAt: string;
  sequence?: number;
  payload: TPayload;
  payloadHash?: string;
}

export type SyncStatus = 'RECEIVED' | 'APPLIED' | 'REJECTED' | 'CONFLICT';

export function assertCaptureContext(context: CaptureContext): void {
  if (!context.actorIdentityId.trim()) throw new Error('actorIdentityId is required');
  if (!context.deviceId.trim()) throw new Error('deviceId is required');
  if (!context.idempotencyKey.trim()) throw new Error('idempotencyKey is required');
  if (Number.isNaN(Date.parse(context.capturedAt))) throw new Error('capturedAt must be an ISO date');
}

export function assertGeoCapture(location: GeoCapture): void {
  if (location.latitude < -90 || location.latitude > 90) throw new Error('latitude out of range');
  if (location.longitude < -180 || location.longitude > 180) throw new Error('longitude out of range');
  if (location.accuracyMeters !== undefined && location.accuracyMeters < 0) {
    throw new Error('accuracyMeters cannot be negative');
  }
}

export function assertMonotonicSequence(previous: number | undefined, next: number | undefined): void {
  if (previous !== undefined && next !== undefined && next <= previous) {
    throw new Error('operation sequence must increase monotonically');
  }
}
