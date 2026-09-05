import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Overview = {
  source: string;
  syntheticData: boolean;
  counts: Record<string, number>;
};

type Status = { service: string; version: string; sourceOfTruth: string; syntheticData: boolean };

type RegulatorySource = {
  id: string;
  authority: string;
  title: string;
  instrument: string;
  reference: string;
  jurisdiction: string;
  status: string;
  effective_from?: string | null;
  source_url?: string | null;
};

const labels: Record<string, string> = {
  activities: "Activities",
  measurements: "Measurements",
  evidence: "Evidence",
  approvedVerifications: "Approved verification",
  openObligations: "Open obligations",
  issuedOrActiveCredentials: "Credentials",
  settledTransactions: "Settled transactions",
};

async function api<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

function App() {
  const [token, setToken] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sources, setSources] = useState<RegulatorySource[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const total = useMemo(() => overview ? Object.values(overview.counts).reduce((a, b) => a + b, 0) : 0, [overview]);

  async function refresh(activeToken = token) {
    setLoading(true);
    setError("");
    try {
      const publicStatus = await api<Status>("/api/v1/status", "");
      setStatus(publicStatus);
      const regulatory = await api<{ sources: RegulatorySource[] }>("/api/v1/regulatory/sources", "");
      setSources(regulatory.sources);
      if (!activeToken) {
        setOverview(null);
        setError("Enter an authenticated session token to load organization data.");
        return;
      }
      setOverview(await api<Overview>("/api/v1/overview", activeToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load authoritative data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(""); }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">R</span><div><strong>RupayKG</strong><span>circular economy operating system</span></div></div>
        <div className="system-state"><span className={`dot ${status ? "ready" : ""}`} /> {status ? "API connected" : "Connecting…"}</div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">AUTHORITATIVE OPERATIONS</p>
            <h1>From physical activity to verified value.</h1>
            <p className="lede">A single operational view across waste, MRV, carbon, EPR, credentials and settlement — always reflecting PostgreSQL authority.</p>
          </div>
          <div className="authority-card">
            <span>Source of truth</span>
            <strong>{status?.sourceOfTruth ?? "—"}</strong>
            <small>{status?.syntheticData ? "Synthetic data enabled" : "Synthetic data disabled"}</small>
          </div>
        </section>

        <section className="session-panel">
          <div><p className="eyebrow">AUTHENTICATED SESSION</p><strong>Organization workspace</strong><p>Session credentials stay in memory and are never persisted by this UI.</p></div>
          <form onSubmit={(event) => { event.preventDefault(); setToken(draftToken.trim()); void refresh(draftToken.trim()); }}>
            <input aria-label="Bearer session token" type="password" value={draftToken} onChange={(e) => setDraftToken(e.target.value)} placeholder="Paste bearer session token" autoComplete="off" />
            <button type="submit" disabled={loading}>{loading ? "Loading…" : "Connect"}</button>
            {token && <button type="button" className="secondary" onClick={() => { setToken(""); setDraftToken(""); setOverview(null); setError(""); }}>Disconnect</button>}
          </form>
        </section>

        {error && <div className="notice" role="alert">{error}</div>}

        <section className="section-heading"><div><p className="eyebrow">CONTROL TOWER</p><h2>Authoritative state</h2></div><span>{overview ? `${total} recorded items` : "No organization snapshot"}</span></section>
        <section className="metrics">
          {Object.entries(labels).map(([key, label]) => <article className="metric" key={key}><span>{label}</span><strong>{overview?.counts[key] ?? "—"}</strong><small>{overview ? "PostgreSQL" : "Requires session"}</small></article>)}
        </section>

        <section className="section-heading"><div><p className="eyebrow">REGULATORY PROVENANCE</p><h2>Source catalogue</h2></div><span>{sources ? `${sources.length} authoritative records` : "Loading…"}</span></section>
        <section className="source-list">
          {sources?.length ? sources.map(source => <article className="source-row" key={source.id}><div><strong>{source.title}</strong><p>{source.authority} · {source.instrument} · {source.reference}</p></div><span className="status-pill">{source.status}</span></article>) : <div className="empty">No regulatory records are available from the authoritative database.</div>}
        </section>
      </main>
      <footer><span>RupayKG</span><span>Backend-authoritative · no fabricated success states</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
