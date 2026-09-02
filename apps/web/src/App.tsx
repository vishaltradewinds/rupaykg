import { useEffect, useState } from "react";

type Overview = { source: string; syntheticData: boolean; counts: Record<string, number> };
type Health = { status: string; database: string; syntheticData: boolean };
const nav = ["Command Center", "Resource Flows", "MRV & Evidence", "Compliance", "Carbon", "Registry", "Settlement", "Regulatory Watch"];

const apiBase = "";

export default function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      fetch(`${apiBase}/api/v1/overview`).then(async r => r.ok ? r.json() : Promise.reject(new Error(`Overview HTTP ${r.status}`))),
      fetch(`${apiBase}/health`).then(r => r.ok ? r.json() : Promise.reject(new Error(`Health HTTP ${r.status}`))),
    ]).then(([o, h]) => { setOverview(o); setHealth(h); }).catch(e => setError(e instanceof Error ? e.message : "API unavailable"));
  }, []);
  const count = (key: string) => overview?.counts[key] ?? "—";
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="mark">R</span><div><strong>RupayKg</strong><small>Circular Economy OS</small></div></div><div className="scope">● India / Nationwide</div><nav>{nav.map((item,i)=><button className={i===0?"active":""} key={item}>{item}</button>)}</nav><div className="sidebar-foot">Urban + Rural<br/><span>Authoritative operations platform</span></div></aside>
    <main><header className="topbar"><div><p className="eyebrow">NATIONAL OPERATIONS</p><h1>Command Center</h1></div><div className="top-actions"><span className="live">● {health?.status ?? "CHECKING"}</span><button className="profile">Operator</button></div></header>
      <section className="notice"><strong>Truth layer active.</strong> Operational numbers below come only from PostgreSQL. An empty value means no authoritative record exists yet; it is never replaced with demo data.</section>
      <section className="hero-grid"><article className="hero-card"><div className="card-label">PLATFORM STATE</div><div className="hero-value">{health?.status ?? "CHECKING"}</div><p>{overview?.source ?? "Authoritative persistence"}</p></article>
      {[["Activities","activities"],["Measurements","measurements"],["Evidence","evidence"]].map(([label,key])=><article className="metric" key={key}><span>{label}</span><strong>{count(key)}</strong><small>authoritative records</small></article>)}</section>
      {error && <div className="error">Authoritative API unavailable: {error}</div>}
      <section className="section-head"><div><p className="eyebrow">LIFECYCLE</p><h2>From activity to verified value</h2></div><span className="state-pill">No fabricated metrics</span></section>
      <div className="pipeline">{["Generate","Aggregate","Measure","Transport","Process","Evidence","Verify","Value","Registry","Settle","Report"].map((s,i)=><div className="step" key={s}><b>{String(i+1).padStart(2,"0")}</b><span>{s}</span>{i<10&&<em>→</em>}</div>)}</div>
      <section className="lower-grid"><article className="panel"><div className="panel-title"><div><p className="eyebrow">LIVE COUNTERS</p><h3>Verified operating state</h3></div></div><ul className="controls"><li><span>Approved verifications</span><b>{count("approvedVerifications")}</b></li><li><span>Open obligations</span><b>{count("openObligations")}</b></li><li><span>Issued / active credentials</span><b>{count("issuedOrActiveCredentials")}</b></li><li><span>Settled transactions</span><b>{count("settledTransactions")}</b></li></ul></article>
      <article className="panel"><div className="panel-title"><div><p className="eyebrow">GEOGRAPHY</p><h3>India operating hierarchy</h3></div></div><div className="geo">{["India","State / UT","District","Block / Taluk","ULB / Gram Panchayat","Ward / Village / Cluster"].map(x=><span key={x}>{x}</span>)}</div><p className="muted">Urban and rural workflows converge on the same authoritative resource, evidence and value model.</p></article></section>
      <footer>RupayKg · Backend authoritative · Regulatory changes require review before production activation</footer>
    </main>
  </div>;
}
