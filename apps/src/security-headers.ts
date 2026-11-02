import type { FastifyInstance } from "fastify";

/**
 * Apply the baseline browser security policy to API and static responses.
 * CSP is intentionally separate until the SPA's assets and evidence workflows
 * have a compatibility-tested policy.
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    // Keep same-origin camera/geolocation available for field evidence capture.
    reply.header("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
    return payload;
  });
}
