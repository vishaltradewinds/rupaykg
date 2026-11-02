export type RuntimeDatabaseRoleState = {
  roleName: string;
  isSuperuser: boolean;
  canCreateDatabase: boolean;
  canCreateRole: boolean;
  canReplicate: boolean;
  bypassesRls: boolean;
  ownsDatabase: boolean;
  canCreateInDatabase: boolean;
  ownsPublicSchema: boolean;
  ownsPublicObjects: boolean;
  canCreateInPublicSchema: boolean;
  hasUnsafeTablePrivileges: boolean;
};

/**
 * Production API connections must use a dedicated non-owner runtime role.
 * Schema changes belong to a separate migration identity, not the API process.
 */
export function runtimeDatabaseRoleFailure(state: RuntimeDatabaseRoleState): string | null {
  if (!state.roleName.trim()) return "PRODUCTION_DB_ROLE_INVALID: current database role could not be identified.";

  const forbidden: string[] = [];
  if (state.isSuperuser) forbidden.push("SUPERUSER");
  if (state.canCreateDatabase) forbidden.push("CREATEDB");
  if (state.canCreateRole) forbidden.push("CREATEROLE");
  if (state.canReplicate) forbidden.push("REPLICATION");
  if (state.bypassesRls) forbidden.push("BYPASSRLS");
  if (state.ownsDatabase) forbidden.push("database ownership");
  if (state.canCreateInDatabase) forbidden.push("CREATE on database");
  if (state.ownsPublicSchema) forbidden.push("public schema ownership");
  if (state.ownsPublicObjects) forbidden.push("public application object ownership");
  if (state.canCreateInPublicSchema) forbidden.push("CREATE on public schema");
  if (state.hasUnsafeTablePrivileges) forbidden.push("TRUNCATE/REFERENCES/TRIGGER table privileges");

  if (!forbidden.length) return null;
  return `PRODUCTION_DB_ROLE_INVALID: runtime role "${state.roleName}" has forbidden privileges (${forbidden.join(", ")}). Configure a dedicated least-privilege runtime role separate from the migration role.`;
}
