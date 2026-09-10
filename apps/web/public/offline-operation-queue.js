(() => {
  const DB_NAME = "rupaykg-field-operations";
  const STORE = "pending";
  const REJECTED_STORE = "rejected";
  const DB_VERSION = 4;
  const isOperationSync = (url, method) => method.toUpperCase() === "POST" && (url.startsWith("/api/v1/operations/sync") || url.includes("/api/v1/operations/sync"));
  const isLogout = (url, method) => method.toUpperCase() === "POST" && (url.startsWith("/api/v1/auth/logout") || url.includes("/api/v1/auth/logout"));
  let sessionAuthorization = "";
  let sessionOrganization = "";

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(REJECTED_STORE)) db.createObjectStore(REJECTED_STORE, { keyPath: "id" });
      if (request.oldVersion < 3) {
        const store = request.transaction.objectStore(STORE);
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const value = cursor.value;
          if (value?.headers) {
            const headers = new Headers(value.headers);
            headers.delete("authorization");
            cursor.update({ ...value, headers: Array.from(headers.entries()) });
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const put = async (storeName, record) => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  const all = async (storeName) => {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  };

  const remove = async (storeName, id) => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  const emitCounts = async () => {
    try {
      const [pending, rejected] = await Promise.all([all(STORE), all(REJECTED_STORE)]);
      window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { status: "COUNTS", pending: pending.length, rejected: rejected.length } }));
    } catch {}
  };

  async function replay() {
    if (!navigator.onLine || !sessionAuthorization) return;
    let records = [];
    try { records = await all(STORE); } catch { return; }
    for (const record of records) {
      try {
        const headers = new Headers(record.headers || []);
        headers.set("Authorization", sessionAuthorization);
        if (sessionOrganization) headers.set("X-RupayKG-Organization-Id", sessionOrganization);
        const response = await originalFetch(record.url, { method: record.method, headers, body: record.body });
        if (response.ok) {
          await remove(STORE, record.id);
          window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id: record.id, status: "SYNCED" } }));
        } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          let error = null;
          try { error = await response.clone().json(); } catch { try { error = await response.clone().text(); } catch {} }
          await put(REJECTED_STORE, { ...record, status: "REJECTED", rejectedAt: new Date().toISOString(), httpStatus: response.status, error });
          await remove(STORE, record.id);
          window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id: record.id, status: "REJECTED", httpStatus: response.status } }));
        }
      } catch {
        break;
      }
    }
    void emitCounts();
  }

  window.addEventListener("online", () => void replay());
  window.addEventListener("rupaykg:session-ready", (event) => {
    const detail = event.detail || {};
    if (typeof detail.authorization === "string") sessionAuthorization = detail.authorization;
    if (typeof detail.organizationId === "string") sessionOrganization = detail.organizationId;
    void replay();
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    const sourceHeaders = init?.headers || (input instanceof Request ? input.headers : undefined);
    const headers = new Headers(sourceHeaders);
    const authorization = headers.get("Authorization");
    const organization = headers.get("X-RupayKG-Organization-Id");

    if (isLogout(url, method)) {
      sessionAuthorization = "";
      sessionOrganization = "";
      return originalFetch(input, init);
    }
    if (authorization) sessionAuthorization = authorization;
    if (organization) sessionOrganization = organization;
    if (!isOperationSync(url, method) || navigator.onLine) {
      const response = await originalFetch(input, init);
      if (authorization || organization) void replay();
      return response;
    }

    let body = init?.body;
    if (body === undefined && input instanceof Request) body = await input.clone().text();
    headers.delete("Authorization");
    const id = crypto.randomUUID();
    const queuedAt = new Date().toISOString();
    await put(STORE, { id, url, method, headers: Array.from(headers.entries()), body: typeof body === "string" ? body : null, queuedAt, organizationId: organization || sessionOrganization || null });
    window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id, status: "QUEUED", queuedAt } }));
    void emitCounts();
    return new Response(JSON.stringify({ queued: true, operation: { status: "PENDING", id, queuedAt } }), { status: 202, headers: { "Content-Type": "application/json" } });
  };
  void emitCounts();
})();
