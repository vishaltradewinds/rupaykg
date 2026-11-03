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
  geography_scope_execute: boolean;
  public_create: boolean;
  required_table_reads: boolean;
  job_update: boolean;
  job_insert: boolean;
  job_delete: boolean;
  job_truncate: boolean;
  event_insert: boolean;
  event_update: boolean;
  event_delete: boolean;
  event_truncate: boolean;
  provenance_insert: boolean;
  provenance_update: boolean;
  provenance_delete: boolean;
  provenance_truncate: boolean;
  source_table_write: boolean;
}

/**
 * Fail closed unless the worker is a dedicated, non-inheriting, non-owner,
 * non-bypass login with only the currently required MRV data privileges.
 * This is a runtime privilege gate, not a substitute for SECURITY DEFINER APIs.
 */
export function assertMrvWorkerRoleContract(role: MrvWorkerRoleContract | undefined): void {
  if (!role || role.current_user !== "rupaykg_mrv_worker_runtime"
      || role.session_user !== role.current_user || !role.rolcanlogin || role.rolinherit
      || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole
      || role.rolreplication || role.owner_membership || role.elevated_membership
      || role.any_role_membership || !role.geography_scope_execute || role.public_create
      || !role.required_table_reads || !role.job_update || role.job_insert || role.job_delete || role.job_truncate
      || !role.event_insert || role.event_update || role.event_delete || role.event_truncate
      || !role.provenance_insert || role.provenance_update || role.provenance_delete || role.provenance_truncate
      || role.source_table_write) {
    throw new Error("MRV_WORKER_DATABASE_ROLE_CONTRACT_FAILED");
  }
}
