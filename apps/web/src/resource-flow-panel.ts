import { getAuth, onAuthStateChanged } from "firebase/auth";
import { initializeApp } from "firebase/app";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const configured = Object.values(config).every(Boolean);
const root = document.getElementById("resource-flow-intake");
if (root && configured) {
  const firebaseAuth = getAuth(initializeApp(config, "resource-flow-intake"));
  let sessionToken = "";
  let organizationId = "";
  let canRecord = false;
  let geography: Array<{ id: string; name: string; kind: string }> = [];

  root.innerHTML = `
    <section class="resource-flow-card">
      <div class="resource-flow-head">
        <div><p class="eyebrow">AUTHORITATIVE MUTATION</p><h2>Resource flow intake</h2><p>Record a real movement of material through the authoritative API. Organization, capability and geography authorization remain server-enforced.</p></div>
        <span class="resource-flow-state" data-state>Sign in to record</span>
      </div>
      <form data-form>
        <div class="resource-flow-grid">
          <label class="form-field"><span>Origin type</span><select name="originType" required><option value="">Select origin</option><option value="HOUSEHOLD">Household</option><option value="COMMERCIAL">Commercial</option><option value="INDUSTRIAL">Industrial</option><option value="MUNICIPAL">Municipal</option><option value="AGRICULTURAL">Agricultural</option><option value="INSTITUTIONAL">Institutional</option></select></label>
          <label class="form-field"><span>Resource form</span><select name="resourceForm" required><option value="">Select form</option><option value="MIXED_WASTE">Mixed waste</option><option value="SEGREGATED_WASTE">Segregated waste</option><option value="RECYCLABLE">Recyclable material</option><option value="ORGANIC">Organic material</option><option value="RECYCLED_OUTPUT">Recycled output</option><option value="OTHER">Other</option></select></label>
          <label class="form-field"><span>Material code</span><input name="materialCode" placeholder="Authoritative material code" required /></label>
          <label class="form-field"><span>Quantity</span><input name="quantity" type="number" min="0.000001" step="any" placeholder="Observed quantity" required /></label>
          <label class="form-field"><span>Unit</span><input name="unit" placeholder="kg, tonne, litre, etc." required /></label>
          <label class="form-field"><span>Source geography</span><select name="sourceGeographyId"><option value="">None supplied</option></select></label>
          <label class="form-field"><span>Destination geography</span><select name="destinationGeographyId"><option value="">None supplied</option></select></label>
        </div>
        <div class="resource-flow-actions"><button type="submit" data-submit disabled>Record resource flow</button><button type="button" class="secondary" data-refresh>Refresh authorization</button></div>
        <p class="field-help" data-message>At least one authorized source or destination geography is required. Quantity must be positive.</p>
      </form>
    </section>`;

  const form = root.querySelector<HTMLFormElement>("[data-form]")!;
  const state = root.querySelector<HTMLElement>("[data-state]")!;
  const message = root.querySelector<HTMLElement>("[data-message]")!;
  const submit = root.querySelector<HTMLButtonElement>("[data-submit]")!;
  const source = form.elements.namedItem("sourceGeographyId") as HTMLSelectElement;
  const destination = form.elements.namedItem("destinationGeographyId") as HTMLSelectElement;

  function setMessage(text: string, error = false) { message.textContent = text; message.classList.toggle("error-text", error); }
  async function exchange() {
    const user = firebaseAuth.currentUser;
    if (!user || !user.emailVerified) { sessionToken = ""; organizationId = ""; canRecord = false; submit.disabled = true; state.textContent = "Sign in to record"; setMessage("Verify your email and sign in with a verified stakeholder membership."); return; }
    try {
      const idToken = await user.getIdToken(true);
      const exchange = await fetch("/api/v1/auth/exchange", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ idToken }) });
      const exchangeBody = await exchange.json();
      if (!exchange.ok) throw new Error(exchangeBody?.error ?? "Session exchange failed");
      sessionToken = exchangeBody.sessionToken;
      const meResponse = await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${sessionToken}`, Accept: "application/json" } });
      const me = await meResponse.json();
      if (!meResponse.ok) throw new Error(me?.error ?? "Unable to load stakeholder membership");
      const verifiedMembership = Array.isArray(me?.memberships)
        ? me.memberships.find((membership: { status?: string }) => membership?.status === "VERIFIED")
        : null;
      organizationId = verifiedMembership?.organization_id ?? "";
      canRecord = Array.isArray(verifiedMembership?.permissions) && verifiedMembership.permissions.includes("waste:record");
      if (!organizationId) throw new Error("A verified organization membership is required to record resource flows.");
      state.textContent = canRecord ? "Authorized stakeholder" : "Read-only stakeholder";
      await loadGeography();
      submit.disabled = !canRecord;
      setMessage(canRecord ? "Authorized. Record only observed material movements; the API will re-check permissions and geography scope." : "Your verified membership is read-only for resource recording; no write action is available.", !canRecord);
    } catch (error) {
      sessionToken = ""; organizationId = ""; canRecord = false; submit.disabled = true; state.textContent = "Authorization unavailable"; setMessage(error instanceof Error ? error.message : "Authorization unavailable", true);
    }
  }
  async function loadGeography() {
    const response = await fetch("/api/v1/geography/roots", { headers: { Authorization: `Bearer ${sessionToken}`, Accept: "application/json" } });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error ?? "Authorized geography unavailable");
    geography = body?.data?.geography ?? [];
    for (const select of [source, destination]) {
      select.innerHTML = `<option value="">None supplied</option>` + geography.map(g => `<option value="${g.id}">${g.name} · ${g.kind}</option>`).join("");
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!sessionToken || !organizationId || !canRecord) return;
    const data = new FormData(form);
    const sourceGeographyId = String(data.get("sourceGeographyId") ?? "").trim();
    const destinationGeographyId = String(data.get("destinationGeographyId") ?? "").trim();
    if (!sourceGeographyId && !destinationGeographyId) { setMessage("Select an authorized source or destination geography.", true); return; }
    submit.disabled = true;
    setMessage("Recording against the authoritative PostgreSQL API…");
    try {
      const response = await fetch("/api/v1/resource-flows", { method: "POST", headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ organizationId, originType: String(data.get("originType") ?? ""), resourceForm: String(data.get("resourceForm") ?? ""), materialCode: String(data.get("materialCode") ?? ""), quantity: Number(data.get("quantity")), unit: String(data.get("unit") ?? ""), ...(sourceGeographyId ? { sourceGeographyId } : {}), ...(destinationGeographyId ? { destinationGeographyId } : {}) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? `Resource flow creation failed (${response.status})`);
      setMessage(`Resource flow recorded: ${body.resourceFlow?.id ?? "authoritative record created"}`);
      form.reset();
      source.value = ""; destination.value = "";
      window.dispatchEvent(new CustomEvent("rupaykg:resource-flow-created"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Resource flow creation failed", true); }
    finally { submit.disabled = !sessionToken || !organizationId || !canRecord; }
  });
  root.querySelector<HTMLButtonElement>("[data-refresh]")!.addEventListener("click", () => void exchange());
  onAuthStateChanged(firebaseAuth, () => void exchange());
} else if (root) {
  root.innerHTML = `<section class="resource-flow-card"><p class="field-help">Resource-flow intake is unavailable until the Firebase client configuration is present.</p></section>`;
}
