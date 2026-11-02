export type DatabaseTlsMode = "require" | "false" | undefined;

export type DatabaseTlsConfig = {
  rejectUnauthorized: true;
  ca?: string;
} | undefined;

/**
 * Never silently disable PostgreSQL certificate verification.
 * Internal Render connections may explicitly opt out only through the
 * validated production configuration; all other TLS connections verify peers.
 */
export function databaseTlsConfig(mode: DatabaseTlsMode, caCert?: string): DatabaseTlsConfig {
  if (mode === "false") return undefined;
  const ca = caCert?.trim();
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
  };
}
