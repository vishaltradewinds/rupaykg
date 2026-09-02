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

async function withMetaTransaction<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(META, mode);
  const store = tx.objectStore(META);
  const result = await fn(store);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
  return result;
}

async function metaGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, "readonly");
    const req = tx.objectStore(META).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getDeviceId(): Promise<string> {
  return withMetaTransaction("readwrite", async store => {
    const existing = await new Promise<string | undefined>((resolve, reject) => {
      const req = store.get(DEVICE_KEY);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) return existing;
    const id = crypto.randomUUID();
    store.put(id, DEVICE_KEY);
    return id;
  });
}

async function nextSequence(): Promise<number> {
  return withMetaTransaction("readwrite", async store => {
    const current = await new Promise<number | undefined>((resolve, reject) => {
      const req = store.get(SEQUENCE_KEY);
      req.onsuccess = () => resolve(req.result as number | undefined);
      req.onerror = () => reject(req.error);
    });
    const next = (current ?? 0) + 1;
    store.put(next, SEQUENCE_KEY);
    return next;
  });
}

export async function enqueue(payload: QueuedEnvelope["payload"]): Promise<QueuedEnvelope> {
  const now = new Date().toISOString();
  const envelope: QueuedEnvelope = {
    localId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    deviceId: await getDeviceId(),
    clientSequence: await nextSequence(),
    capturedAt: now,
    payload,
    state: "QUEUED",
    updatedAt: now,
  };
  const db = await openDb();
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
    req.onsuccess = () => {
      if (!req.result) {
        tx.abort();
        reject(new Error("Queue item not found"));
        return;
      }
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
        body: JSON.stringify({
          deviceId: item.deviceId,
          idempotencyKey: item.idempotencyKey,
          clientSequence: item.clientSequence,
          capturedAt: item.capturedAt,
          payload: { operationType: item.payload.operation, ...item.payload },
        }),
      });
      if (!response.ok) throw new Error(`submit HTTP ${response.status}`);
      const accepted = await response.json() as { envelope?: { id?: string }; envelopeId?: string };
      const serverEnvelopeId = accepted.envelopeId ?? accepted.envelope?.id;
      if (!serverEnvelopeId) throw new Error("submit response did not include envelope id");
      await updateQueue(item.localId, { state: "RECEIVED", serverEnvelopeId });
      const apply = await fetchImpl(`/api/v1/field-sync/envelopes/${serverEnvelopeId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (apply.ok) await updateQueue(item.localId, { state: "APPLIED" });
      else if (apply.status === 409) await updateQueue(item.localId, { state: "CONFLICT", error: `apply HTTP ${apply.status}` });
      else if (apply.status === 400 || apply.status === 403) throw new Error(`apply HTTP ${apply.status}`);
      else throw new Error(`apply HTTP ${apply.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      const isOnline = typeof navigator === "undefined" || navigator.onLine !== false;
      await updateQueue(item.localId, { state: isOnline ? "FAILED" : "QUEUED", error: message });
    }
  }
  return listQueue();
}
