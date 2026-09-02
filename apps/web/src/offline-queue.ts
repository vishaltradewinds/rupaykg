export type OfflineOperation = "ACTIVITY_CREATE" | "MEASUREMENT_CREATE" | "EVIDENCE_CREATE" | "RESOURCE_FLOW_CREATE";
export type QueueState = "QUEUED" | "SENDING" | "RECEIVED" | "APPLIED" | "CONFLICT" | "FAILED";
export type QueuedEnvelope = {
  localId: string;
  idempotencyKey: string;
  deviceId: string;
  clientSequence: number;
  capturedAt: string;
  payload: { operation: OfflineOperation; [key: string]: unknown };
  state: QueueState;
  serverEnvelopeId?: string;
  error?: string;
  updatedAt: string;
};

const DB_NAME = "rupaykg-field-sync";
const STORE = "envelopes";
const META = "meta";
const DEVICE_KEY = "deviceId";
const SEQUENCE_KEY = "clientSequence";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "localId" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

function allocateDeviceAndSequence(db: IDBDatabase): Promise<{ deviceId: string; clientSequence: number }> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    let deviceId: string | undefined;
    let sequence: number | undefined;
    let settled = false;
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error("IndexedDB metadata transaction failed")); } };
    const deviceReq = store.get(DEVICE_KEY);
    deviceReq.onerror = () => fail(deviceReq.error);
    deviceReq.onsuccess = () => {
      deviceId = (deviceReq.result as string | undefined) ?? crypto.randomUUID();
      if (!deviceReq.result) store.put(deviceId, DEVICE_KEY);
      const sequenceReq = store.get(SEQUENCE_KEY);
      sequenceReq.onerror = () => fail(sequenceReq.error);
      sequenceReq.onsuccess = () => {
        sequence = ((sequenceReq.result as number | undefined) ?? 0) + 1;
        store.put(sequence, SEQUENCE_KEY);
      };
    };
    tx.oncomplete = () => { if (!settled && deviceId && sequence !== undefined) { settled = true; resolve({ deviceId, clientSequence: sequence }); } };
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error ?? new Error("IndexedDB metadata transaction aborted"));
  });
}

export async function getDeviceId(): Promise<string> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, "readonly");
    const req = tx.objectStore(META).get(DEVICE_KEY);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? "");
    req.onerror = () => reject(req.error ?? new Error("Device identity unavailable"));
  });
}

export async function enqueue(payload: QueuedEnvelope["payload"]): Promise<QueuedEnvelope> {
  const db = await openDb();
  const { deviceId, clientSequence } = await allocateDeviceAndSequence(db);
  const now = new Date().toISOString();
  const envelope: QueuedEnvelope = {
    localId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    deviceId,
    clientSequence,
    capturedAt: now,
    payload,
    state: "QUEUED",
    updatedAt: now,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(envelope);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Queue write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Queue write aborted"));
  });
  return envelope;
}

export async function listQueue(): Promise<QueuedEnvelope[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedEnvelope[]).sort((a, b) => a.clientSequence - b.clientSequence));
    req.onerror = () => reject(req.error);
  });
}

export async function updateQueue(localId: string, patch: Partial<QueuedEnvelope>): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(localId);
    req.onerror = () => { try { tx.abort(); } catch {} reject(req.error ?? new Error("Queue lookup failed")); };
    req.onsuccess = () => {
      if (!req.result) { try { tx.abort(); } catch {} reject(new Error("Queue item not found")); return; }
      store.put({ ...req.result, ...patch, updatedAt: new Date().toISOString() });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Queue update failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Queue update aborted"));
  });
}

export async function syncQueue(token: string, fetchImpl = fetch): Promise<QueuedEnvelope[]> {
  const items = await listQueue();
  for (const item of items.filter(x => x.state === "QUEUED" || x.state === "FAILED")) {
    try {
      await updateQueue(item.localId, { state: "SENDING", error: undefined });
      const response = await fetchImpl("/api/v1/field-sync/envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deviceId: item.deviceId, idempotencyKey: item.idempotencyKey, clientSequence: item.clientSequence, capturedAt: item.capturedAt, payload: { operationType: item.payload.operation, ...item.payload } }),
      });
      if (!response.ok) throw new Error(`submit HTTP ${response.status}`);
      const accepted = await response.json() as { envelope?: { id?: string }; envelopeId?: string };
      const serverEnvelopeId = accepted.envelopeId ?? accepted.envelope?.id;
      if (!serverEnvelopeId) throw new Error("submit response did not include envelope id");
      await updateQueue(item.localId, { state: "RECEIVED", serverEnvelopeId });
      const apply = await fetchImpl(`/api/v1/field-sync/envelopes/${serverEnvelopeId}/apply`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (apply.ok) await updateQueue(item.localId, { state: "APPLIED" });
      else if (apply.status === 409) await updateQueue(item.localId, { state: "CONFLICT", error: `apply HTTP ${apply.status}` });
      else throw new Error(`apply HTTP ${apply.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      await updateQueue(item.localId, { state: isOnline ? "FAILED" : "QUEUED", error: message });
    }
  }
  return listQueue();
}
