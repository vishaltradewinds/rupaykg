import { useCallback, useEffect, useState } from "react";
import { api, type FieldConflict, type Health, type Overview, type RegulatoryResponse, type ResourceFlow } from "./api.js";

const nav = ["Command Center", "Resource Flows", "MRV & Evidence", "Compliance", "Carbon", "Registry", "Settlement", "Regulatory Watch"];
const token = import.meta.env.VITE_RUPAYKG_SESSION_TOKEN ?? "";

function State({ value }: { value: unknown }) {
  const text = value == null ? "—" : String(value);
  return <span className={`status ${text.toLowerCase().replaceAll("_", "-")}`}>{text}</span>;
}

function Rows({ rows, columns }: { rows: Array<Record<string, unknown>>; columns: string[] }) {
  if (!rows.length) return <p className="muted">No authoritative records available.</p>;
  return <div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c}>{c.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(c => <td key={c}>{c === "status" || c === "decision" || c === "quality_status" ? <State value={row[c]} /> : String(row[c] ?? "—")}</td>)}</tr>)}</tbody></table></div>;
}

export default function App() {
  const [active, setActive] = useState("Command Center");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [regulatory, setRegulatory] = useState<RegulatoryResponse | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [o, h, r] = await Promise.all([api.overview(), api.health(), api.regulatory()]);
      setOverview(o); setHealth(h); setRegulatory(r); setError(null);
      if (!token) { setData(null); return; }
      const workspace = active === "Resource Flows" ? await api.resourceFlows(token)
        : active === "MRV & Evidence" ? await api.mrv(token)
        : active === "Compliance" ? await api.compliance(token)
        : active === "Carbon" ? await api.carbon(token)
        : active === "Registry" ? await api.registry(token)
        : active === "Settlement" ? await api.settlement(token)
        : null;
      if (workspace) setData(workspace.data as Record<string, unknown>);
      const c = await api.conflicts(token);
      setConflicts(c.data.conflicts);
    } catch (e) { setError(e instanceof Error ? e.message : "Authoritative API unavailable"); }
    finally { setRefreshing(false); }
  }, [active]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const t = window.setInterval(() => void refresh(), 30000); return () => window.clearInterval(t); }, [refresh]);

  const count = (key: string) => overview?.counts[key] ?? "—";
  const descriptions: Record<string, string> = {
    "Command Center": "National operating state across India's circular-economy lifecycle.", "Resource Flows": "Generation, aggregation, measurement, transport and processing.", "MRV & Evidence": "Measurement provenance and verification decisions.", Compliance: "Obligations and evidence-backed compliance decisions.", Carbon: "Methodology-backed calculations before value issuance.", Registry: "Credential lifecycle, ownership and retirement events.", Settlement: "Authorized execution and external reconciliation.", "Regulatory Watch": "Authoritative instruments and production applicability."
  };

  return <div className="shell"><aside className="sidebar"><div className="brand"><span className="mark">R</span><div><strong>RupayKg</strong><small>Circular Economy OS</small></div></div><div className="scope">● India / Nationwide</div><nav aria-label="Workspaces">{nav.map(item => <button className={active === item ? "active" : ""} onClick={() => setActive(item)} key={item}>{item}</button>)}</nav><div className="sidebar-foot">Urban + Rural<br/><span>Authoritative operations platform</span></div></aside>
    <main><header className="topbar"><div><p className="eyebrow">NATIONAL OPERATIONS</p><h1>{active}</h1><p className="workspace-description">{descriptions[active]}</p></div><div className="top-actions"><span className={health?.status === "READY" ? "live ready" : "live"}>● {health?.status ?? "CHECKING"}</span><button className="profile" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button></div></header>
      <section className="notice"><strong>Truth layer active.</strong> All operational workspace data is PostgreSQL-backed. No synthetic fallback is used.</section>
      {error && <div className="error" role="alert">{error}</div>}
      {!token && active !== "Command Center" && active !== "Regulatory Watch" && <div className="auth-banner"><strong>Authenticated session required.</strong> Set <code>VITE_RUPAYKG_SESSION_TOKEN</code> for workspace API access. No credentials are stored by this UI.</div>}

      {active === "Command Center" && <><section className="hero-grid"><article className="hero-card"><div className="card-label">PLATFORM STATE</div><div className="hero-value">{health?.status ?? "CHECKING"}</div><p>{health?.database ?? "Database status pending"} · {overview?.source ?? "Authoritative persistence"}</p></article>{[["Activities","activities"],["Measurements","measurements"],["Evidence","evidence"]].map(([l,k]) => <article className="metric" key={k}><span>{l}</span><strong>{count(k)}</strong><small>authoritative records</small></article>)}</section><section className="section-head"><div><p className="eyebrow">LIFECYCLE</p><h2>From activity to verified value</h2></div><span className="state-pill">No fabricated metrics</span></section><div className="pipeline">{["Generate","Aggregate","Measure","Transport","Process","Evidence","Verify","Value","Registry","Settle","Report"].map((s,i)=><div className="step" key={s}><b>{String(i+1).padStart(2,"0")}</b><span>{s}</span>{i<10&&<em>→</em>}</div>)}</div><section className="lower-grid"><article className="panel"><p className="eyebrow">LIVE COUNTERS</p><h3>Verified operating state</h3><ul className="controls">{[["Approved verifications","approvedVerifications"],["Open obligations","openObligations"],["Issued / active credentials","issuedOrActiveCredentials"],["Settled transactions","settledTransactions"]].map(([l,k])=><li key={k}><span>{l}</span><b>{count(k)}</b></li>)}</ul></article><article className="panel"><p className="eyebrow">GEOGRAPHY</p><h3>India operating hierarchy</h3><div className="geo">{["India","State / UT","District","Block / Taluk","ULB / Gram Panchayat","Ward / Village / Cluster"].map(x=><span key={x}>{x}</span>)}</div><p className="muted">Urban and rural workflows use the same authoritative resource, evidence and value model.</p></article></section></>}

      {active === "Regulatory Watch" && <section className="panel workspace-detail"><div className="panel-title"><div><p className="eyebrow">AUTHORITATIVE CATALOG</p><h2>Regulatory instruments</h2></div><span className="state-pill">{regulatory?.sources.length ?? "—"} records</span></div><div className="regulatory-list">{(regulatory?.sources ?? []).map(s=><article className="reg-row" key={s.id}><div><strong>{s.title}</strong><span>{s.authority} · {s.reference}</span></div><div><b>{s.status}</b><small>{s.affected_module ?? "Cross-platform"}</small></div></article>)}</div></section>}

      {active !== "Command Center" && active !== "Regulatory Watch" && <section className="workspace-detail panel"><div className="workspace-state-head"><div className="workspace-icon">{active[0]}</div><div><p className="eyebrow">POSTGRESQL WORKSPACE</p><h2>{active}</h2><p>{descriptions[active]}</p></div></div>{active === "Resource Flows" && <Rows rows={(data?.resourceFlows as ResourceFlow[] ?? []) as Array<Record<string,unknown>>} columns={["material_code","declared_quantity","unit","status","origin_type"]}/>} {active === "MRV & Evidence" && <><h3>Activities</h3><Rows rows={(data?.activities as Array<Record<string,unknown>> ?? [])} columns={["activity_type","status","occurred_at","geography_name"]}/><h3>Evidence</h3><Rows rows={(data?.evidence as Array<Record<string,unknown>> ?? [])} columns={["evidence_type","status","captured_at","content_hash"]}/><h3>Verifications</h3><Rows rows={(data?.verifications as Array<Record<string,unknown>> ?? [])} columns={["decision","scope","decided_at"]}/></>} {active === "Compliance" && <Rows rows={(data?.obligations as Array<Record<string,unknown>> ?? [])} columns={["organization_name","obligation_type","required_quantity","status","period_end"]}/>} {active === "Carbon" && <Rows rows={(data?.calculations as Array<Record<string,unknown>> ?? [])} columns={["methodology_code","methodology_version","result","unit","status","calculated_at"]}/>} {active === "Registry" && <><h3>Credentials</h3><Rows rows={(data?.credentials as Array<Record<string,unknown>> ?? [])} columns={["issuer_name","status","issued_at"]}/><h3>Registry events</h3><Rows rows={(data?.events as Array<Record<string,unknown>> ?? [])} columns={["event_type","from_owner_name","to_owner_name","external_reference","created_at"]}/></>} {active === "Settlement" && <Rows rows={(data?.settlements as Array<Record<string,unknown>> ?? [])} columns={["payer_name","payee_name","amount","currency","status","external_reference","settled_at"]}/>}<div className="workspace-rule"><b>Authoritative state</b><span>PostgreSQL source</span><span>No synthetic data</span><span>Verification gates value</span></div></section>}

      {token && conflicts.length > 0 && <section className="panel conflicts"><div className="panel-title"><div><p className="eyebrow">FIELD SYNC</p><h3>Open synchronization conflicts</h3></div><span className="state-pill">{conflicts.length}</span></div>{conflicts.filter(c => c.resolution_status === "OPEN").map(c=><div className="conflict" key={c.id}><div><strong>{c.entity_type}</strong><span>{c.conflict_type} · {c.entity_id}</span></div><button onClick={async () => { await api.resolveConflict(token, c.id, "RESOLVED", "Reviewed in operations console"); await refresh(); }}>Mark reviewed</button></div>)}</section>}
      <footer>RupayKg · Backend authoritative · AI is advisory and cannot directly mutate authoritative state</footer>
    </main></div>;
}
