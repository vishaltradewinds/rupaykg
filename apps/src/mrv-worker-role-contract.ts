export interface MrvWorkerRoleContract {
  current_user: string;
  session_user: string;
  rolcanlogin: boolean;
  rolinherit: boolean;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
  owner_membership: boolean;
  elevated_membership: boolean;
  any_role_membership: boolean;
  public_create: boolean;
  direct_table_privileges: boolean;
  worker_api_execute: boolean;
  public_worker_api_execute: boolean;
}

/**
 * The runtime identity is function-only. It must not read or mutate application
 * tables directly; the SECURITY DEFINER API is the sole database boundary.
 * This gate intentionally rejects the current direct-SQL worker implementation.
 */
export function assertMrvWorkerRoleContract(role: MrvWorkerRoleContract | undefined): void {
  if (!role || role.current_user !== "rupaykg_mrv_worker_runtime"
      || role.session_user !== role.current_user || !role.rolcanlogin || role.rolinherit
      || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole
      || role.rolreplication || role.owner_membership || role.elevated_membership
      || role.any_role_membership || role.public_create || role.direct_table_privileges
      || !role.worker_api_execute || role.public_worker_api_execute) {
    throw new Error("MRV_WORKER_DATABASE_ROLE_CONTRACT_FAILED");
  }
}
