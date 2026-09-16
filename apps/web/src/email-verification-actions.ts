import { getApps, initializeApp } from "firebase/app";
import { getAuth, sendEmailVerification, setPersistence, signInWithEmailAndPassword, signOut, browserSessionPersistence } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!Object.values(config).every(Boolean)) {
  console.warn("RupayKG email verification actions unavailable: Firebase is not configured.");
} else {
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  void setPersistence(auth, browserSessionPersistence);

  const findInputs = () => {
    const drawer = document.querySelector(".auth-drawer");
    if (!drawer) return null;
    const email = drawer.querySelector('input[type="email"]') as HTMLInputElement | null;
    const password = drawer.querySelector('input[type="password"]') as HTMLInputElement | null;
    if (!email || !password) return null;
    return { drawer, email, password };
  };

  const ensureActions = () => {
    const found = findInputs();
    if (!found) return;
    const { drawer, email, password } = found;
    if (drawer.querySelector("[data-rupaykg-verification-actions]")) return;

    const wrap = document.createElement("div");
    wrap.dataset.rupaykgVerificationActions = "true";
    wrap.style.cssText = "display:flex;flex-wrap:wrap;gap:7px;margin-top:8px";

    const status = document.createElement("p");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "margin:4px 0 0;font-size:11px;line-height:1.45";

    const setStatus = (text: string, kind: "normal" | "error" = "normal") => {
      status.textContent = text;
      status.style.color = kind === "error" ? "#fca5a5" : "#a8c4b0";
    };

    const makeButton = (label: string, handler: () => Promise<void>) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = label;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await handler(); } finally { button.disabled = false; }
      });
      return button;
    };

    const credentials = () => {
      const emailValue = email.value.trim();
      const passwordValue = password.value;
      if (!emailValue || !passwordValue) {
        setStatus("Enter your email and password first.", "error");
        return null;
      }
      return { emailValue, passwordValue };
    };

    const resend = async () => {
      const c = credentials();
      if (!c) return;
      setStatus("Sending verification email…");
      try {
        const result = await signInWithEmailAndPassword(auth, c.emailValue, c.passwordValue);
        if (result.user.emailVerified) {
          setStatus("This email is already verified. Refreshing access…");
          window.location.reload();
          return;
        }
        await sendEmailVerification(result.user);
        await signOut(auth);
        setStatus("Verification email sent. Check your inbox and spam folder.");
      } catch (error) {
        await signOut(auth).catch(() => undefined);
        const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
        const message = code.includes("too-many-requests")
          ? "Too many attempts. Wait a little before requesting another email."
          : code.includes("invalid-credential") || code.includes("wrong-password")
            ? "The email or password is not correct."
            : "Verification email could not be sent. Check the email/password and try again.";
        setStatus(message, "error");
      }
    };

    const refresh = async () => {
      const c = credentials();
      if (!c) return;
      setStatus("Checking verification status…");
      try {
        const result = await signInWithEmailAndPassword(auth, c.emailValue, c.passwordValue);
        await result.user.reload();
        if (!result.user.emailVerified) {
          await signOut(auth);
          setStatus("Email is still unverified. Open the verification email first.", "error");
          return;
        }
        setStatus("Email verified. Opening RupayKG…");
        window.location.reload();
      } catch (error) {
        await signOut(auth).catch(() => undefined);
        const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
        setStatus(code.includes("invalid-credential") || code.includes("wrong-password") ? "The email or password is not correct." : "Could not check verification status. Try again.", "error");
      }
    };

    wrap.append(
      makeButton("Resend verification email", resend),
      makeButton("I verified — check again", refresh),
    );
    drawer.appendChild(wrap);
    drawer.appendChild(status);
  };

  new MutationObserver(ensureActions).observe(document.documentElement, { childList: true, subtree: true });
  ensureActions();
}
