// Browser fetch compatibility overload for conditionally constructed headers.
// This affects only TypeScript's DOM signature; runtime headers and authorization
// values remain exactly as constructed by the application.
declare function fetch(input: RequestInfo | URL, init?: any): Promise<Response>;
