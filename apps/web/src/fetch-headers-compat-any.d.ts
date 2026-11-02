// Browser fetch compatibility overload for conditionally constructed headers.
// Keep the overload limited to the browser RequestInit contract; it exists only
// because some independently mounted panels build plain string header maps.
declare function fetch(
  input: RequestInfo | URL,
  init?: RequestInit | (Omit<RequestInit, "headers"> & { headers?: Record<string, string> })
): Promise<Response>;
