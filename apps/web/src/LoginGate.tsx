import { FormEvent, useEffect, useState } from "react";

type Props = { onAuthenticated: () => void };

export default function LoginGate({ onAuthenticated }: Props) {
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("rupaykg.sessionToken");
    if (saved) setToken(saved);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value) {
      setError("Enter your RupayKG session token.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/geography/roots", {
        headers: { Authorization: `Bearer ${value}` },
      });
      if (response.status === 401) throw new Error("Invalid or expired session token.");
      if (!response.ok) throw new Error("Authentication service is unavailable. Please try again.");
      sessionStorage.setItem("rupaykg.sessionToken", value);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand"><span className="mark">R</span><div><strong>RupayKg</strong><small>Circular Economy OS</small></div></div>
        <p className="eyebrow">SECURE ACCESS</p>
        <h1 id="login-title">Sign in to RupayKG</h1>
        <p className="login-copy">Use your authorized session token to access the national operations workspace.</p>
        <form onSubmit={submit}>
          <label htmlFor="session-token">Session token</label>
          <input id="session-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Enter session token" autoComplete="current-password" autoFocus />
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-button" type="submit" disabled={checking}>{checking ? "Verifying…" : "Sign in"}</button>
        </form>
        <p className="login-security">Your token is kept in this browser session only. It is never written to source code.</p>
      </section>
    </main>
  );
}
