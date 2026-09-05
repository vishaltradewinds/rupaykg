import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Overview = { source: string; syntheticData: boolean; counts: Record<string, number> };
type Status = { service: string; version: string; sourceOfTruth: string; syntheticData: boolean };
type Health = { status: "READY" | "DEGRADED"; database: "AVAILABLE" | "UNAVAILABLE"; syntheticData: boolean };
type RegulatorySource = { id: string; authority: string; title: string; instrument: string; reference: string; jurisdiction: string; status: string; effective_from?: string | null; source_url?: string | null };
type Workspace = { source: string; syntheticData: boolean; data?: Record<string, unknown>; [key: string]: unknown };
type WorkspaceKey = "mrv" | "compliance" | "carbon" | "registry" | "settlement" | "resource-flows" | "intelligence";

const labels: Record<string, string> = {
  activities: "Activities",
  measurements: "Measurements",
  evidence: "Evidence",
  approvedVerifications: "Approved verification",
  openObligations: "Open obligations",
  issuedOrActiveCredentials: "Credentials",
  settledTransactions: "Settled transactions",
};

const workspaces: Array<{ key: WorkspaceKey; label: string; path: string; collection: string }> = [
  { key: "mrv", label: "MRV", path: "/api/v1/workspaces/mrv", collection: "activities" },
  { key: "compliance", label: "Compliance", path: "/api/v1/workspaces/compliance", collection: "obligations" },
  { key: "carbon", label: "Carbon", path: "/api/v1/workspaces/carbon", collection: "calculations" },
  { key: "registry", label: "Registry", path: "/api/v1/workspaces/registry", collection: "credentials" },
  { key: "settlement", label: "Settlement", path: "/api/v1/workspaces/settlement", collection: "settlements" },
  { key: "resource-flows", label: "Resource flows", path: "/api/v1/workspaces/resource-flows", collection: "resourceFlows" },
  { key: "intelligence", label: "Intelligence", path: "/api/v1/workspaces/intelligence", collection: "findings" },
];

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function api<T>(path: string, token = ""): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body?.error ?? `Request failed (${response.status})`, response.status);
  return body as T;
}

async function health(): Promise<Health> {
  const response = await fetch("/health", { headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (response.status !== 200 && response.status !== 503) throw new Error(body?.error ?? `Health check failed (${response.status})`);
  return body as Health;
}

function value(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function WorkspaceView({ item, workspace }: { item: Record<string, unknown>; workspace: typeof workspaces[number] }) {
  const entries = Object.entries(item).filter(([key]) => !["metadata", "inputs", "result", "calculation_trace"].includes(key));
  return <article className="workspace-row"><div className="workspace-title"><strong>{value(item.title ?? item.activity_type ?? item.obligation_type ?? item.methodology_code ?? item.status ?? item.kind ?? workspace.label)}</strong><span>{workspace.label}</span></div><div className="workspace-fields">{entries.slice(0, 7).map(([key, fieldValue]) => <span key={key}><b>{key.replaceAll("_", " ")}</b>{value(fieldValue)}</span>)}</div></article>;
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 401 || cause.status === 403) return "The session token was rejected. Enter a valid authenticated session token.";
    return cause.message;
  }
  return cause instanceof Error ? cause.message : "Unable to load authoritative data.";
}

function App() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [backendHealth, setBackendHealth] = useState<Health | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sources, setSources] = useState<RegulatorySource[] | null>(null);
  const [workspaceData, setWorkspaceData] = useState<Partial<Record<WorkspaceKey, Workspace>>>({});
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceKey>("mrv");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => overview ? Object.values(overview.counts).reduce((a, b) => a + b, 0) : 0, [overview]);
  const selected = workspaces.find((item) => item.key === selectedWorkspace)!;

  async function refresh(activeToken = token) {
    setLoading(true); setError("");
    let runtimeHealth: Health;
    try {
      runtimeHealth = await health();
      setBackendHealth(runtimeHealth);
    } catch (cause) {
      setBackendHealth(null);
      setOverview(null); setWorkspaceData({});
      setError(errorMessage(cause));
      setLoading(false);
      return;
    }

    if (runtimeHealth.status !== "READY" || runtimeHealth.database !== "AVAILABLE") {
      setOverview(null); setWorkspaceData({});
      setError("Authoritative PostgreSQL is unavailable; organization data remains hidden.");
      setLoading(false);
      return;
    }

    try {
      const [publicStatus, regulatory] = await Promise.all([
        api<Status>("/api/v1/status"),
        api<{ sources: RegulatorySource[] }>("/api/v1/regulatory/sources"),
      ]);
      setStatus(publicStatus);
      setSources(regulatory.sources);
      if (!activeToken) {
        setOverview(null); setWorkspaceData({});
        setError("Enter an authenticated session token to load organization data.");
        return;
      }
      const [nextOverview, ...workspaceResults] = await Promise.all([
        api<Overview>("/api/v1/overview", activeToken),
        ...workspaces.map(async (workspace) => ({ key: workspace.key, data: await api<Workspace>(workspace.path, activeToken) })),
      ]);
      setOverview(nextOverview);
      setWorkspaceData(Object.fromEntries(workspaceResults.map(({ key, data }) => [key, data])) as Partial<Record<WorkspaceKey, Workspace>>);
    } catch (cause) {
      setOverview(null); setWorkspaceData({});
      setError(errorMessage(cause));
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(""); }, []);

  const selectedData = workspaceData[selectedWorkspace];
  const selectedRows = selectedData ? ((selectedData[selected.collection] ?? selectedData.data?.[selected.collection] ?? []) as unknown[]) : [];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">R</span><div><strong>RupayKG</strong><span>circular economy operating system</span></div></div>
      <div className="system-state" aria-live="polite"><span className={`dot ${backendHealth?.status === "READY" ? "ready" : ""}`} /> {backendHealth?.status === "READY" ? "Backend ready" : backendHealth?.status === "DEGRADED" ? "Backend degraded" : "Backend status unavailable"}</div>
    </header>

    <main>
      <section className="hero">
        <div><p className="eyebrow">AUTHORITATIVE OPERATIONS</p><h1>From physical activity to verified value.</h1><p className="lede">One operational view across waste, MRV, carbon, EPR, credentials and settlement — reflecting authoritative PostgreSQL state rather than invented UI state.</p></div>
        <div className="authority-card"><span>Source of truth</span><strong>{status?.sourceOfTruth ?? "—"}</strong><small>{status?.syntheticData ? "Synthetic data enabled" : backendHealth?.status === "READY" ? "Synthetic data disabled" : "Authoritative database unavailable"}</small></div>
      </section>

      <section className="session-panel">
        <div><p className="eyebrow">AUTHENTICATED SESSION</p><strong>Organization workspace</strong><p>Session credentials stay in memory and are never persisted by this UI.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); const next = draftToken.trim(); setToken(next); void refresh(next); }}><input aria-label="Bearer session token" type="password" value={draftToken} onChange={(e) => setDraftToken(e.target.value)} placeholder="Paste bearer session token" autoComplete="off" /><button type="submit" disabled={loading}>{loading ? "Loading…" : "Connect"}</button>{token && <button type="button" className="secondary" onClick={() => { setToken(""); setDraftToken(""); setOverview(null); setWorkspaceData({}); setError(""); }}>Disconnect</button>}</form>
      </section>

      {error && <div className="notice" role="alert">{error}</div>}

      <section className="section-heading"><div><p className="eyebrow">CONTROL TOWER</p><h2>Authoritative state</h2></div><span>{overview ? `${total} recorded items` : "No organization snapshot"}</span></section>
      <section className="metrics">{Object.entries(labels).map(([key, label]) => <article className="metric" key={key}><span>{label}</span><strong>{overview?.counts[key] ?? "—"}</strong><small>{overview ? "PostgreSQL" : "Requires ready backend + session"}</small></article>)}</section>

      <section className="section-heading"><div><p className="eyebrow">OPERATING WORKSPACES</p><h2>Backend projections</h2></div><span>{token && backendHealth?.status === "READY" ? "Authenticated" : "Requires ready backend + session"}</span></section>
      <nav className="workspace-tabs" aria-label="Operating workspaces">{workspaces.map((workspace) => <button type="button" key={workspace.key} className={selectedWorkspace === workspace.key ? "tab active" : "tab"} onClick={() => setSelectedWorkspace(workspace.key)} disabled={!token || backendHealth?.status !== "READY"} aria-pressed={selectedWorkspace === workspace.key}>{workspace.label}</button>)}</nav>
      <section className="workspace-panel">
        <div className="workspace-panel-head"><div><strong>{selected.label}</strong><span>{selectedData ? `${selectedRows.length} records returned by the authoritative API` : "No organization data loaded"}</span></div>{token && backendHealth?.status === "READY" && <button type="button" className="secondary" onClick={() => void refresh(token)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>}</div>
        {!token ? <div className="empty">Connect an authenticated session to view this workspace. No placeholder records are shown.</div> : backendHealth?.status !== "READY" ? <div className="empty">The authoritative backend is not ready. No organization records are shown.</div> : selectedRows.length ? selectedRows.slice(0, 100).map((row, index) => <WorkspaceView key={index} item={(row && typeof row === "object" ? row : { value: row }) as Record<string, unknown>} workspace={selected} />) : <div className="empty">The authoritative API returned no records for this workspace.</div>}
      </section>

      <section className="section-heading"><div><p className="eyebrow">REGULATORY PROVENANCE</p><h2>Source catalogue</h2></div><span>{sources ? `${sources.length} authoritative records` : "Loading…"}</span></section>
      <section className="source-list">{sources?.length ? sources.map(source => <article className="source-row" key={source.id}><div><strong>{source.title}</strong><p>{source.authority} · {source.instrument} · {source.reference}</p></div><span className="status-pill">{source.status}</span></article>) : <div className="empty">No regulatory records are available from the authoritative database.</div>}</section>
    </main>
    <footer><span>RupayKG</span><span>Backend-authoritative · no fabricated success states</span></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
