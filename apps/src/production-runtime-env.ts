import type { ProductionConfig } from "./production-config.js";

export type RequestContextRuntimeConfig = Pick<
  ProductionConfig,
  "requestContextSecret" | "requestContextKeyId"
>;

/**
 * Copies already-validated signing material into the server-only runtime
 * environment before the API module is imported. Never create Vite/client
 * aliases for these values.
 */
export function applyRequestContextRuntimeEnvironment(
  config: RequestContextRuntimeConfig,
  target: NodeJS.ProcessEnv = process.env,
): void {
  target.RUPAYKG_REQUEST_CONTEXT_SECRET = config.requestContextSecret;
  target.RUPAYKG_REQUEST_CONTEXT_KEY_ID = config.requestContextKeyId;
}
