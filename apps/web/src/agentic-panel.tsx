import { useState } from "react";

type Goal = "review_measurements" | "prepare_compliance" | "trace_resource_flow" | "onboard_stakeholder";
type Step = { id: string; title: string; status: "READY" | "BLOCKED" | "REQUIRES_HUMAN"; reason: string; requiredEvidence: string[] };
type Plan = { goal: Goal; mode: string; source: string; syntheticData: false; sourceRecordIds: string[]; steps: Step[]; blockers: string[]; canExecute: false; humanApprovalRequired: true; modelExplanation?: { status: "DISABLED" | "UNAVAILABLE" | "COMPLETED"; explanation: string | null } };
const goals: Array<{ value: Goal; label: string; description: string }> = [
  { value: "review_measurements", label: "Review measurements", description: "Check recorded measurement coverage and prepare a human review." },
  { value: "prepare_compliance", label: "Prepare compliance", description: "Identify activity, evidence and independent-verification gaps." },
  { value: "trace_resource_flow", label: "Trace resource flow", description: "Prepare a source-grounded custody and evidence reconciliation." },
  { value: "onboard_stakeholder", label: "Stakeholder onboarding", description: "Prepare a due-diligence checklist without approving identity or membership." },
];
function organizationId(): string { return window.localStorage.getItem("rupaykg.activeOrganizationId")?.trim() ?? ""; }

export function AgenticPanel({ token }: { token: string }) {
  const [goal, setGoal] = useState<Goal>("prepare_compliance");
  const [geographyId, setGeographyId] = useState("");
  const [explain, setExplain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  async function createPlan() {
    if (!token) { setError("Sign in with an authorized organization account first."); return; }
    setBusy(true); setError(""); setPlan(null);
    try {
      const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` });
      const org = organizationId();
      if (org) headers.set("X-RupayKG-Organization-Id", org);
      const response = await fetch(`/api/v1/agentic/plan${explain ? "?explain=true" : ""}`, {
        method: "POST", headers,
        body: JSON.stringify({ goal, ...(geographyId.trim() ? { geographyId: geographyId.trim() } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
      setPlan(body as Plan);
    } catch (e) { setError(e instanceof Error ? e.message : "Agentic planning failed."); }
    finally { setBusy(false); }
  }
  return <section className="agentic-panel">
    <div className="section-heading"><div><p className="eyebrow">GOVERNED AGENTIC AI</p><h2>Workflow copilot</h2></div><span>Read-only · evidence-gated</span></div>
    <p>Choose an operational goal. RupayKg checks authorized records and returns a plan with explicit missing-evidence blockers. The agent cannot execute transactions, approve compliance or change authoritative records.</p>
    <div className="agentic-form">
      <label>What do you want to do?
        <select value={goal} onChange={e => setGoal(e.target.value as Goal)}>{goals.map(g => <option value={g.value} key={g.value}>{g.label}</option>)}</select>
      </label>
      <label>Geography ID (optional)
        <input value={geographyId} onChange={e => setGeographyId(e.target.value)} placeholder="Use an authorized geography UUID" />
      </label>
      <label className="agentic-check"><input type="checkbox" checked={explain} onChange={e => setExplain(e.target.checked)} /> Explain the plan with the optional configured AI model</label>
      <button onClick={() => void createPlan()} disabled={busy}>{busy ? "Preparing plan…" : "Create evidence-grounded plan"}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {plan && <div className="agentic-result">
      <div className="agentic-summary"><strong>{goals.find(g => g.value === plan.goal)?.label}</strong><span>{plan.source} · synthetic data: no · execution: disabled</span></div>
      {plan.modelExplanation && <aside className="agentic-explanation"><strong>Model explanation: {plan.modelExplanation.status}</strong><p>{plan.modelExplanation.explanation ?? (plan.modelExplanation.status === "DISABLED" ? "No model is configured; the source-grounded plan is still available." : "The model is unavailable; use the evidence-grounded plan below.")}</p></aside>}
      <div className="agentic-steps">{plan.steps.map(step => <article key={step.id} className="agentic-step">
        <div><strong>{step.title}</strong><span className={step.status === "READY" ? "trust-ready" : step.status === "BLOCKED" ? "trust-blocked" : ""}>{step.status.replaceAll("_", " ")}</span></div>
        <p>{step.reason}</p><small>Evidence needed: {step.requiredEvidence.join(", ")}</small>
      </article>)}</div>
      <p className="agentic-boundary">Human approval required: {plan.humanApprovalRequired ? "yes" : "no"} · Can execute actions: {plan.canExecute ? "yes" : "no"}</p>
    </div>}
  </section>;
}
