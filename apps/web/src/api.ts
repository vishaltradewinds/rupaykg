export type Overview = { source: string; syntheticData: boolean; counts: Record<string, number> };
export type Health = { status: string; database: string; syntheticData: boolean };
export type RegulatorySource = { id: string; authority: string; title: string; instrument: string; reference: string; effective_from: string | null; jurisdiction: string; status: string; affected_module: string | null };
export type RegulatoryResponse = { source: string; syntheticData: boolean; sources: RegulatorySource[] };

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const api = {
  overview: () => get<Overview>("/api/v1/overview"),
  health: () => get<Health>("/health"),
  regulatory: () => get<RegulatoryResponse>("/api/v1/regulatory/sources"),
};
