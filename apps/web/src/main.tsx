import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const statusLabels = ["VERIFIED", "PENDING", "UNAVAILABLE"] as const;

function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">RUPAYKG / OPERATIONS</div>
          <h1>India Circular Economy Command Center</h1>
          <p>Authoritative operational visibility across urban and rural resource flows.</p>
        </div>
        <span className="status">Backend-authoritative</span>
      </header>

      <section className="notice">
        <strong>Truthful data mode.</strong> Live metrics appear only when the API has authoritative persisted data. Demo or unavailable sources are labeled explicitly.
      </section>

      <section className="grid">
        <article><span>Material flows</span><strong>—</strong><small>Awaiting authoritative data</small></article>
        <article><span>MRV queue</span><strong>—</strong><small>Awaiting authoritative data</small></article>
        <article><span>EPR obligations</span><strong>—</strong><small>Awaiting authoritative data</small></article>
        <article><span>Settlement</span><strong>—</strong><small>Awaiting authoritative data</small></article>
      </section>

      <section className="workspace">
        <aside>
          <h2>Operations</h2>
          <nav>
            {[
              "National overview",
              "Urban operations",
              "Rural operations",
              "Field capture",
              "MRV & evidence",
              "Carbon",
              "EPR",
              "Registry",
              "Settlement",
              "Audit explorer",
            ].map((item) => <button key={item}>{item}</button>)}
          </nav>
        </aside>
        <div className="panel">
          <h2>System state</h2>
          <p>Nothing is simulated in the production UI.</p>
          <div className="badges">{statusLabels.map((label) => <span key={label}>{label}</span>)}</div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
