/**
 * Acceptance fixtures must never be written to a production environment.
 * The check is independent of the synthetic-data flag and runs before any
 * database connection is created.
 */
export function shouldRunAcceptanceSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  const requested = env.RUPAYKG_ACCEPTANCE_SEED_ON_START === "true";
  if (env.NODE_ENV === "production" && requested) {
    throw new Error("ACCEPTANCE_SEED_FORBIDDEN_IN_PRODUCTION");
  }
  return requested;
}
