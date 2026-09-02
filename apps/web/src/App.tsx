import { useEffect, useState } from "react";

type Status = {
  service: string;
  version: string;
  sourceOfTruth: string;
  syntheticData: boolean;
};

type Health = {
  status: "READY" | "DEGRADED";
  database: "AVAILABLE" | "UNAVAILABLE";
  syntheticData: boolean;
};

const nav = ["Command Center", "Resource Flows", "MRV & Evidence", "Compliance", "Carbon", "Registry", "Settlement", "Regulatory Watch"];

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    Promise.all([
      fetch(`${base}/api/v1/status`).then((r) => r.ok ? r.json() : Promise.reject(new Error(`Status HTTP ${r.status}`))),
      fetch(`${base}/health`).then((r) => r.json()),
    ]).then(([nextStatus, nextHealth]) => {
      setStatus(nextStatus);
      setHealth(nextHealth);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unable to reach the authoritative API");
    });
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="mark">R</span><div><strong>RupayKg</strong><small>Circular Economy OS</small></div></div>
        <div className="scope"><span>●</span> India / Nationwide</div>
        <nav>{nav.map((item, index) => <button className={index === 0 ? "active" : ""} key={item}>{item}</button>)}</nav>
        <div className="sidebar-foot">Urban + Rural<br/><span>Authoritative operations platform</span></div>
      </aside>
      <main>
        <header className="topbar"><div><p className="eyebrow">NATIONAL OPERATIONS</p><h1>Command Center</h1></div><div className="top-actions"><span className="live"><i /> Live system state</span><button className="profile">Operator</button></div></header>
        <section className="notice"><strong>Truth layer active.</strong> Only persisted and verified records can become operational claims. Demo, simulated and unavailable data are visibly separated.</section>
        <section className="hero-grid">
          <article className="hero-card"><div className="card-label">PLATFORM STATE</div><div className="hero-value">{health?.status ?? "CHECKING"}</div><p>{status?.sourceOfTruth ?? "PostgreSQL authoritative store"}</p></article>
          <article className="metric"><span>Database</span><strong>{health?.database ?? "CHECKING"}</strong><small>authoritative persistence</small></article>
          <article className="metric"><span>Mode</span><strong>{health?.syntheticData === false ? "REAL DATA ONLY" : "UNKNOWN"}</strong><small>no synthetic operational claims</small></article>
          <article className="metric"><span>API</span><strong>{status?.version ?? "—"}</strong><small>RupayKg service</small></article>
        </section>
        {error && <div className="error">API connection unavailable: {error}</div>}
        <section className="section-head"><div><p className="eyebrow">OPERATING MODEL</p><h2>From activity to verified value</h2></div><span className="state-pill">No fabricated metrics</span></section>
        <div className="pipeline">{["Generate", "Aggregate", "Measure", "Transport", "Process", "Evidence", "Verify", "Value", "Registry", "Settle", "Report"].map((step, i) => <div className="step" key={step}><b>{String(i + 1).padStart(2, "0")}</b><span>{step}</span>{i < 10 && <em>→</em>}</div>)}</div>
        <section className="lower-grid">
          <article className="panel"><div className="panel-title"><div><p className="eyebrow">TRUST CONTROLS</p><h3>Operational readiness</h3></div><span className="verified-dot">●</span></div><ul className="controls"><li><span>Evidence before value</span><b>ENFORCED</b></li><li><span>Verification before issuance</span><b>ENFORCED</b></li><li><span>Registry before transfer</span><b>ENFORCED</b></li><li><span>Settlement reconciliation</span><b>GOVERNED</b></li><li><span>Regulatory status gating</span><b>VERSIONED</b></li></ul></article>
          <article className="panel"><div className="panel-title"><div><p className="eyebrow">GEOGRAPHY</p><h3>India operating hierarchy</h3></div></div><div className="geo"><span>India</span><span>State / UT</span><span>District</span><span>Block / Taluk</span><span>ULB / Gram Panchayat</span><span>Ward / Village / Cluster</span></div><p className="muted">Urban and rural workflows converge on the same authoritative resource, evidence and value model.</p></article>
        </section>
        <footer>RupayKg v{status?.version ?? "0.1.0"} · Backend authoritative · Regulatory changes require review before production activation</footer>
      </main>
    </div>
  );
}
