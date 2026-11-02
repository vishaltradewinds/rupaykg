import type { ProductionConfig } from "./production-config.js";

/** Copies validated signing material into server-only runtime variables. */
export function applyProductionRequestContextEnvironment(
  config: Pick<ProductionConfig, "requestContextSecret" | "requestContextKeyId">,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  environment.RUPAYKG_REQUEST_CONTEXT_SECRET = config.requestContextSecret;
  environment.RUPAYKG_REQUEST_CONTEXT_KEY_ID = config.requestContextKeyId;
}
