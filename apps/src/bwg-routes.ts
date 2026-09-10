import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

/**
 * BWG routes are registered by the authoritative value-route module.
 * Keep this module as a compatibility shim so server registration remains
 * stable without declaring duplicate Fastify routes.
 */
export async function registerBwgRoutes(_app: FastifyInstance, _pool: Pool | null): Promise<void> {
  return;
}
