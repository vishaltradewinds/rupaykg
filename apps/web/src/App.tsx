import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Health, type Overview, type RegulatoryResponse } from "./api.js";

const nav = ["Command Center", "Resource Flows", "MRV & Evidence", "Compliance", "Carbon", "Registry", "Settlement", "Regulatory Watch"];
const workspaceCards: Record<string, Array<[string, string, string]>> = {
  "Resource Flows": [["Activities", "activities", "generation, collection and processing records"], ["Measurements", "measurements", "authoritative measured observations"], ["Evidence", "evidence", "evidence records awaiting or carrying verification"]],
  "MRV & Evidence": [["Measurements", "measurements", "measurement observations"], ["Evidence", "evidence", "provenance records"], ["Approved verifications", "approvedVerifications", "verification decisions"]],
  Compliance: [["Open obligations", "openObligations", "obligations requiring evidence or action"], ["Approved verifications", "approvedVerifications", "evidence-backed decisions"], ["Evidence", "evidence", "available provenance records"]],
  Carbon: [["Activities", "activities", "source activity records"], ["Measurements", "measurements", "measurement inputs"], ["Approved verifications", "approvedVerifications", "verification gate before value issuance"]],
  Registry: [["Credentials", "issuedOrActiveCredentials", "authoritative credential lifecycle records"], ["Approved verifications", "approvedVerifications", "verification gate"], ["Activities", "activities", "source activity records"]],
  Settlement: [["Settled transactions", "settledTransactions", "externally confirmed settlement records"], ["Credentials", "issuedOrActiveCredentials", "credential-linked value records"], ["Open obligations", "openObligations", "unresolved compliance obligations"]],
};

export default function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [regulatory, setRegulatory] = useState<RegulatoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState("Command Center");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [o, h, r] = await Promise.all([api.overview(), api.health(), api.regulatory()]);
      setOverview(o); setHealth(h); setRegulatory(r); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authoritative API unavailable");
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const count = (key: string) => overview?.counts[key] ?? "—";
  const workspaceDescription = useMemo(() => ({
    "Command Center": "National operating state across the circular-economy lifecycle.",
    "Resource Flows": "Track generation, aggregation, transport and processing records.",
    "MRV & Evidence": "Review measurements, evidence provenance and verification state.",
    "Compliance": "Manage obligations and evidence-backed compliance decisions.",
    Carbon: "Review methodology-backed calculations before any value can be issued.",
    Registry: "Govern credentials, ownership transitions and retirement events.",
    Settlement: "Control authorized payment execution and reconciliation.",
    "Regulatory Watch": "Monitor authoritative instruments and production applicability.",
  } as Record<string, string>)[active], [active]);

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">R</span><div><strong>RupayKg</strong><small>Circular Economy OS</small></div></div>
      <div className="scope">● India / Nationwide</div>
      <nav aria-label="Workspaces">{nav.map(item => <button className={active === item ? "active" : ""} onClick={() => setActive(item)} key={item}>{item}</button>)}</nav>
      <div className="sidebar-foot">Urban + Rural<br/><span>Authoritative operations platform</span></div>
    </aside>
    <main>
      <header className="topbar"><div><p className="eyebrow">NATIONAL OPERATIONS</p><h1>{active}</h1><p className="workspace-description">{workspaceDescription}</p></div><div className="top-actions"><span className={health?.status === "READY" ? "live ready" : "live"}>● {health?.status ?? "CHECKING"}</span><button className="profile" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div></header>
      <section className="notice"><strong>Truth layer active.</strong> Operational numbers below come only from PostgreSQL. Empty or unavailable state is never replaced with demo data.</section>
      {error && <div className="error" role="alert">Authoritative API unavailable: {error}</div>}

      {active === "Command Center" ? <>
        <section className="hero-grid"><article className="hero-card"><div className="card-label">PLATFORM STATE</div><div className="hero-value">{health?.status ?? "CHECKING"}</div><p>{health?.database ?? "Database status pending"} · {overview?.source ?? "Authoritative persistence"}</p></article>
          {[["Activities","activities"],["Measurements","measurements"],["Evidence","evidence"]].map(([label,key])=><article className="metric" key={key}><span>{label}</span><strong>{count(key)}</strong><small>authoritative records</small></article>)}</section>
        <section className="section-head"><div><p className="eyebrow">LIFECYCLE</p><h2>From activity to verified value</h2></div><span className="state-pill">No fabricated metrics</span></section>
        <div className="pipeline">{["Generate","Aggregate","Measure","Transport","Process","Evidence","Verify","Value","Registry","Settle","Report"].map((s,i)=><div className="step" key={s}><b>{String(i+1).padStart(2,"0")}</b><span>{s}</span>{i<10&&<em>→</em>}</div>)}</div>
        <section className="lower-grid"><article className="panel"><div className="panel-title"><div><p className="eyebrow">LIVE COUNTERS</p><h3>Verified operating state</h3></div></div><ul className="controls"><li><span>Approved verifications</span><b>{count("approvedVerifications")}</b></li><li><span>Open obligations</span><b>{count("openObligations")}</b></li><li><span>Issued / active credentials</span><b>{count("issuedOrActiveCredentials")}</b></li><li><span>Settled transactions</span><b>{count("settledTransactions")}</b></li></ul></article>
          <article className="panel"><div className="panel-title"><div><p className="eyebrow">GEOGRAPHY</p><h3>India operating hierarchy</h3></div></div><div className="geo">{["India","State / UT","District","Block / Taluk","ULB / Gram Panchayat","Ward / Village / Cluster"].map(x=><span key={x}>{x}</span>)}</div><p className="muted">Urban and rural workflows converge on the same authoritative resource, evidence and value model.</p></article></section>
      </> : active === "Regulatory Watch" ? <section className="panel workspace-detail"><div className="panel-title"><div><p className="eyebrow">AUTHORITATIVE CATALOG</p><h2>Regulatory instruments</h2></div><span className="state-pill">{regulatory?.sources.length ?? "—"} records</span></div><div className="regulatory-list">{(regulatory?.sources ?? []).slice(0, 12).map(source => <article className="reg-row" key={source.id}><div><strong>{source.title}</strong><span>{source.authority} · {source.reference}</span></div><div><b>{source.status}</b><small>{source.affected_module ?? "Cross-platform"}</small></div></article>)}{regulatory && regulatory.sources.length === 0 && <p className="muted">No authoritative regulatory records available.</p>}</div></section> : <section className="workspace-detail"><div className="workspace-state-head"><div className="workspace-icon">{active.slice(0,1)}</div><div><p className="eyebrow">WORKSPACE</p><h2>{active}</h2><p>{workspaceDescription}</p></div></div><div className="workspace-cards">{(workspaceCards[active] ?? []).map(([label,key,detail]) => <article className="metric" key={key}><span>{label}</span><strong>{count(key)}</strong><small>{detail}</small></article>)}</div><div className="workspace-rule"><b>Authoritative state</b><span>PostgreSQL source</span><span>No synthetic data</span><span>Verification gates value</span></div></section>}
      <footer>RupayKg · Backend authoritative · Regulatory changes require review before production activation</footer>
    </main>
  </div>;
}
