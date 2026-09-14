import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

/**
 * Compatibility registration point retained for the server's existing BWG
 * registration order. The authoritative statutory module is registered by
 * the MRV route module; this shim must remain inert to prevent duplicate
 * Fastify statutory route declarations.
 */
export async function registerBwgRoutes(_app: FastifyInstance, _pool: Pool | null): Promise<void> {
  return;
}
