type SessionAwareWindow = Window & { __rupaykgSessionToken?: string };
const target = window as SessionAwareWindow;
const originalFetch = window.fetch.bind(window);

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await originalFetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes("/api/v1/auth/exchange")) {
    response.clone().json().then((body: { sessionToken?: unknown }) => {
      if (typeof body?.sessionToken === "string" && body.sessionToken) {
        target.__rupaykgSessionToken = body.sessionToken;
        window.dispatchEvent(new CustomEvent("rupaykg:session-ready"));
      }
    }).catch(() => undefined);
  }
  if (url.includes("/api/v1/auth/logout")) {
    target.__rupaykgSessionToken = "";
  }
  return response;
};
