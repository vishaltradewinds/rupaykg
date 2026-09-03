export type Overview = { source: string; syntheticData: boolean; counts: Record<string, number> };
export type Health = { status: string; database: string; syntheticData: boolean };
export type RegulatorySource = { id: string; authority: string; title: string; instrument: string; reference: string; effective_from: string | null; jurisdiction: string; status: string; affected_module: string | null };
export type RegulatoryResponse = { source: string; syntheticData: boolean; sources: RegulatorySource[] };
export type Geography = { id: string; parent_id: string | null; kind: string; code: string | null; external_code: string | null; name: string; source: string | null; source_version: string | null; valid_from: string | null; valid_to: string | null; metadata: Record<string, unknown> };
export type IntelligenceFinding = { kind: string; sourceRecordIds: string[]; sourceType: string; title: string; status: string; geography: string | null; occurredAt: string | null; action: "REVIEW"; authoritativeMutation: false };
export type IntelligenceResponse = { source: string; syntheticData: boolean; advisory: true; findings: IntelligenceFinding[] };
type Envelope<T> = { source: string; syntheticData: boolean; data: T };
export type ResourceFlow = { id: string; organization_id: string; organization_name: string; origin_type: string; resource_form: string; material_code: string; declared_quantity: number; unit: string; status: string; source_geography_id: string | null; source_geography_name: string | null; destination_geography_id: string | null; destination_geography_name: string | null; created_at: string };
export type MvrWorkspace = { activities: Array<Record<string, unknown>>; measurements: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; verifications: Array<Record<string, unknown>> };
export type ComplianceWorkspace = { obligations: Array<Record<string, unknown>> };
export type CarbonWorkspace = { calculations: Array<Record<string, unknown>> };
export type RegistryWorkspace = { credentials: Array<Record<string, unknown>>; events: Array<Record<string, unknown>> };
export type SettlementWorkspace = { settlements: Array<Record<string, unknown>> };
export type FieldConflict = { id: string; envelope_id: string; entity_type: string; entity_id: string; conflict_type: string; authoritative_version: unknown; client_version: unknown; resolution_status: string; resolution_reason: string | null; resolved_at: string | null };
export type Workspace = ResourceFlow[] | MvrWorkspace | ComplianceWorkspace | CarbonWorkspace | RegistryWorkspace | SettlementWorkspace;
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
async function get<T>(path: string, token?: string): Promise<T> { const response = await fetch(`${apiBase}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }); if (!response.ok) throw new Error(`${path} HTTP ${response.status}`); return response.json() as Promise<T>; }
async function post<T>(path: string, body: unknown, token: string): Promise<T> { const response = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`${path} HTTP ${response.status}`); return response.json() as Promise<T>; }
export const api = {
 overview: (token: string) => get<Overview>("/api/v1/overview", token), health: () => get<Health>("/health"), regulatory: () => get<RegulatoryResponse>("/api/v1/regulatory/sources"),
 geographyRoots: (token: string) => get<Envelope<{ geography: Geography[] }>>("/api/v1/geography/roots", token),
 geographyChildren: (parentId: string, token?: string) => token ? get<Envelope<{ geography: Geography[] }>>(`/api/v1/geography/children/${parentId}`, token) : Promise.reject(new Error("Authenticated session required for geography access")),
 resourceFlows: (token: string, geographyId?: string) => get<Envelope<{ resourceFlows: ResourceFlow[] }>>(`/api/v1/workspaces/resource-flows${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 mrv: (token: string, geographyId?: string) => get<Envelope<MvrWorkspace>>(`/api/v1/workspaces/mrv${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 compliance: (token: string, geographyId?: string) => get<Envelope<ComplianceWorkspace>>(`/api/v1/workspaces/compliance${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 carbon: (token: string, geographyId?: string) => get<Envelope<CarbonWorkspace>>(`/api/v1/workspaces/carbon${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 registry: (token: string, geographyId?: string) => get<Envelope<RegistryWorkspace>>(`/api/v1/workspaces/registry${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 settlement: (token: string, geographyId?: string) => get<Envelope<SettlementWorkspace>>(`/api/v1/workspaces/settlement${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 intelligence: (token: string, geographyId?: string) => get<IntelligenceResponse>(`/api/v1/workspaces/intelligence${geographyId ? `?geographyId=${encodeURIComponent(geographyId)}` : ""}`, token),
 conflicts: (token: string) => get<Envelope<{ conflicts: FieldConflict[] }>>("/api/v1/field-sync/conflicts", token),
 resolveConflict: (token: string, conflictId: string, resolutionStatus: "RESOLVED" | "REJECTED", resolutionReason: string) => post<unknown>(`/api/v1/field-sync/conflicts/${conflictId}/resolve`, { resolutionStatus, resolutionReason }, token),
};
