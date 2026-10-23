/**
 * Compatibility exports for the historical government bridge module.
 *
 * Keep exactly one implementation of the government inbox. Production registers
 * registerAsyncMirrorRoutes from async-mirror-routes.ts; this module re-exports
 * that same implementation so future callers cannot accidentally revive a
 * divergent handler with different validation or trust semantics.
 */
export {
  registerAsyncMirrorRoutes as registerGovBridgeRoutes,
  verifyGovBridgeSignature,
} from "./async-mirror-routes.js";
