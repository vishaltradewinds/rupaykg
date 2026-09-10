(() => {
  const DB_NAME = "rupaykg-field-operations";
  const STORE = "pending";
  const DB_VERSION = 1;
  const isOperationSync = (url, method) => method.toUpperCase() === "POST" && (url.startsWith("/api/v1/operations/sync") || url.includes("/api/v1/operations/sync"));

  const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
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

  const originalFetch = window.fetch.bind(window);

  async function replay() {
    if (!navigator.onLine) return;
    let records = [];
    try { records = await all(); } catch { return; }
    for (const record of records) {
      try {
        const response = await originalFetch(record.url, {
          method: record.method,
          headers: record.headers,
          body: record.body,
        });
        if (response.ok) {
          await remove(record.id);
          window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id: record.id, status: "SYNCED" } }));
        } else if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          // Permanent authorization/validation failures must not be replayed forever.
          await remove(record.id);
          window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id: record.id, status: "REJECTED", httpStatus: response.status } }));
        }
      } catch {
        break;
      }
    }
  }

  window.addEventListener("online", () => void replay());
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    if (!isOperationSync(url, method) || navigator.onLine) return originalFetch(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    let body = init?.body;
    if (body === undefined && input instanceof Request) body = await input.clone().text();
    const id = crypto.randomUUID();
    await put({ id, url, method, headers: Array.from(headers.entries()), body: typeof body === "string" ? body : null, queuedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("rupaykg:offline-sync", { detail: { id, status: "QUEUED" } }));
    return new Response(JSON.stringify({ queued: true, operation: { status: "PENDING", id, queuedAt: new Date().toISOString() } }), { status: 202, headers: { "Content-Type": "application/json" } });
  };

  void replay();
})();
