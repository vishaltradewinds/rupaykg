# RupayKg — Shakti Batch C Tenant-Isolation Boundary Inventory

Date: 2026-11-06

Status: ENGINEERING REHEARSAL — production READ-ONLY/HOLD.

## Purpose

This batch begins P0 #196 / #285 Batch C by producing a deterministic disposable-PostgreSQL inventory of the public ordinary tables, tenant-boundary classifications and foreign-key relationships.

The script is deliberately **inventory-only**. It does not enable production RLS, change production roles, alter grants, or deploy anything.

## Classification

Each public ordinary table is assigned one provisional class:

- `tenant_owned_direct`: contains an explicit organization/tenant key, or is the organization root.
- `tenant_owned_indirect`: inherits tenant ownership through a foreign-key path from a tenant-owned table.
- `security_control`: identity/session/membership/role/security/audit/migration control data requiring separate policy treatment.
- `global_reference`: not proven tenant-bound by the current FK/column graph; this is **not** an assertion that it is safe to expose globally.

The script fails if known tenant-sensitive domain tables are left in `global_reference`.

## Next gate

The resulting inventory must be reviewed against the actual 67-table production catalog before any RLS policy is authored.

The next engineering batch will:

1. reconcile this inventory against the authoritative production read-only catalog;
2. resolve every `global_reference` and `security_control` classification with evidence;
3. map all policy/function/trigger/grant/search_path dependencies;
4. build a disposable RLS rehearsal with distinct non-owner, NOBYPASSRLS runtime identities;
5. prove SELECT/INSERT/UPDATE/DELETE isolation, connection-pool reuse, multi-tenant requests and worker/system actors;
6. separately test runtime-role/table-owner/BYPASSRLS separation.

## Safety boundary

No production DDL/DML, RLS activation, role/grant/ownership change, deployment, worker activation, certification or TRL 9 declaration is authorized by this batch.

PostgreSQL's documented security model confirms why the runtime identity must be separated from table ownership and BYPASSRLS: table owners normally bypass RLS, while BYPASSRLS roles always bypass it. citeturn832048search0turn832048search3
