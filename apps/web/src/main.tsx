import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Overview = { source: string; syntheticData: boolean; counts: Record<string, number> };
type Status = { service: string; version: string; sourceOfTruth: string; syntheticData: boolean };
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

async function api<T>(path: string, token = ""): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
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

function App() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
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
    try {
      const publicStatus = await api<Status>("/api/v1/status");
      setStatus(publicStatus);
      const regulatory = await api<{ sources: RegulatorySource[] }>("/api/v1/regulatory/sources");
      setSources(regulatory.sources);
      if (!activeToken) { setOverview(null); setWorkspaceData({}); setError("Enter an authenticated session token to load organization data."); return; }
      const [nextOverview, ...workspaceResults] = await Promise.all([
        api<Overview>("/api/v1/overview", activeToken),
        ...workspaces.map(async (workspace) => ({ key: workspace.key, data: await api<Workspace>(workspace.path, activeToken) })),
      ]);
      setOverview(nextOverview);
      setWorkspaceData(Object.fromEntries(workspaceResults.map(({ key, data }) => [key, data])) as Partial<Record<WorkspaceKey, Workspace>>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load authoritative data.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(""); }, []);

  const selectedData = workspaceData[selectedWorkspace];
  const selectedRows = selectedData ? ((selectedData[selected.collection] ?? selectedData.data?.[selected.collection] ?? []) as unknown[]) : [];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">R</span><div><strong>RupayKG</strong><span>circular economy operating system</span></div></div>
      <div className="system-state"><span className={`dot ${status ? "ready" : ""}`} /> {status ? "API connected" : "Connecting…"}</div>
    </header>

    <main>
      <section className="hero">
        <div><p className="eyebrow">AUTHORITATIVE OPERATIONS</p><h1>From physical activity to verified value.</h1><p className="lede">One operational view across waste, MRV, carbon, EPR, credentials and settlement — reflecting authoritative PostgreSQL state rather than invented UI state.</p></div>
        <div className="authority-card"><span>Source of truth</span><strong>{status?.sourceOfTruth ?? "—"}</strong><small>{status?.syntheticData ? "Synthetic data enabled" : "Synthetic data disabled"}</small></div>
      </section>

      <section className="session-panel">
        <div><p className="eyebrow">AUTHENTICATED SESSION</p><strong>Organization workspace</strong><p>Session credentials stay in memory and are never persisted by this UI.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); const next = draftToken.trim(); setToken(next); void refresh(next); }}><input aria-label="Bearer session token" type="password" value={draftToken} onChange={(e) => setDraftToken(e.target.value)} placeholder="Paste bearer session token" autoComplete="off" /><button type="submit" disabled={loading}>{loading ? "Loading…" : "Connect"}</button>{token && <button type="button" className="secondary" onClick={() => { setToken(""); setDraftToken(""); setOverview(null); setWorkspaceData({}); setError(""); }}>Disconnect</button>}</form>
      </section>

      {error && <div className="notice" role="alert">{error}</div>}

      <section className="section-heading"><div><p className="eyebrow">CONTROL TOWER</p><h2>Authoritative state</h2></div><span>{overview ? `${total} recorded items` : "No organization snapshot"}</span></section>
      <section className="metrics">{Object.entries(labels).map(([key, label]) => <article className="metric" key={key}><span>{label}</span><strong>{overview?.counts[key] ?? "—"}</strong><small>{overview ? "PostgreSQL" : "Requires session"}</small></article>)}</section>

      <section className="section-heading"><div><p className="eyebrow">OPERATING WORKSPACES</p><h2>Backend projections</h2></div><span>{token ? "Authenticated" : "Requires session"}</span></section>
      <nav className="workspace-tabs" aria-label="Operating workspaces">{workspaces.map((workspace) => <button key={workspace.key} className={selectedWorkspace === workspace.key ? "tab active" : "tab"} onClick={() => setSelectedWorkspace(workspace.key)} disabled={!token}>{workspace.label}</button>)}</nav>
      <section className="workspace-panel">
        <div className="workspace-panel-head"><div><strong>{selected.label}</strong><span>{selectedData ? `${selectedRows.length} records returned by the authoritative API` : "No organization data loaded"}</span></div>{token && <button className="secondary" onClick={() => void refresh(token)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>}</div>
        {!token ? <div className="empty">Connect an authenticated session to view this workspace. No placeholder records are shown.</div> : selectedRows.length ? selectedRows.slice(0, 100).map((row, index) => <WorkspaceView key={index} item={(row && typeof row === "object" ? row : { value: row }) as Record<string, unknown>} workspace={selected} />) : <div className="empty">The authoritative API returned no records for this workspace.</div>}
      </section>

      <section className="section-heading"><div><p className="eyebrow">REGULATORY PROVENANCE</p><h2>Source catalogue</h2></div><span>{sources ? `${sources.length} authoritative records` : "Loading…"}</span></section>
      <section className="source-list">{sources?.length ? sources.map(source => <article className="source-row" key={source.id}><div><strong>{source.title}</strong><p>{source.authority} · {source.instrument} · {source.reference}</p></div><span className="status-pill">{source.status}</span></article>) : <div className="empty">No regulatory records are available from the authoritative database.</div>}</section>
    </main>
    <footer><span>RupayKG</span><span>Backend-authoritative · no fabricated success states</span></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
