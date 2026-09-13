// Compatibility overload for the browser's fetch HeadersInit typing.
// The application intentionally builds organization-scoped headers conditionally;
// this declaration accepts the resulting plain string map without weakening the
// runtime authorization contract.
declare function fetch(
  input: RequestInfo | URL,
  init?: RequestInit & { headers?: Record<string, string> }
): Promise<Response>;
