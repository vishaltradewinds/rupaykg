(() => {
  const DB_NAME = "rupaykg-field-operations";
  const STORE = "pending";
  const DB_VERSION = 3;
  const isOperationSync = (url, method) => method.toUpperCase() === "POST" && (url.startsWith("/api/v1/operations/sync") || url.includes("/api/v1/operations/sync"));
  const isLogout = (url, method) => method.toUpperCase() === "POST" && (url.startsWith("/api/v1/auth/logout") || url.includes("/api/v1/auth/logout"));
  let sessionAuthorization = "";
  let sessionOrganization = "";

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (request.oldVersion < 2) {
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

  const put = async (record) => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  const all = async () => {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  };

  const remove = async (id) => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  async function replay() {
    if (!navigator.onLine || !sessionAuthorization) return;
    let records = [];
    try { records = await all(); } catch { return; }
    for (const record of records) {
      try {
        const headers = new Headers(record.headers || []);
        headers.set("Authorization", sessionAuthorization);
        if (sessionOrganization) headers.set("X-RupayKG-Organization-Id", sessionOrganization);
        const response = await originalFetch(record.url, { method: record.method, headers, body: record.body });
        if (response.ok) {
          await remove(record.id);
          window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id: record.id, status: "SYNCED" } }));
        } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          await remove(record.id);
          window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id: record.id, status: "REJECTED", httpStatus: response.status } }));
        }
      } catch {
        break;
      }
    }
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

    // Logout is the security boundary: revoke the in-memory replay credential before
    // sending the logout request so queued work can never replay under the old session.
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
    await put({ id, url, method, headers: Array.from(headers.entries()), body: typeof body === "string" ? body : null, queuedAt });
    window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id, status: "QUEUED", queuedAt } }));
    return new Response(JSON.stringify({ queued: true, operation: { status: "PENDING", id, queuedAt } }), { status: 202, headers: { "Content-Type": "application/json" } });
  };
})();
