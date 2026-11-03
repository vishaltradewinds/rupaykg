import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 9222;
const chrome = spawn("google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--no-first-run",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${port}`,
  "--user-data-dir=/tmp/rupaykg-chrome-interactions",
  "http://127.0.0.1:4173/",
], { stdio: "ignore" });

let socket;
try {
  let version;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        version = await response.json();
        break;
      }
    } catch {}
    await delay(250);
  }
  assert.ok(version, "Chrome DevTools endpoint did not start");

  const targetsResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  assert.ok(targetsResponse.ok, "Chrome target list unavailable");
  const targets = await targetsResponse.json();
  const target = targets.find(item => item.type === "page" && item.url.startsWith("http://127.0.0.1:4173/"));
  assert.ok(target?.webSocketDebuggerUrl, "landing page target not found");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const response = await command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
    }
    return response.result?.value;
  };
  const waitForRender = "await new Promise(resolve => setTimeout(resolve, 60));";
  const pageReady = await evaluate(`(async()=> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const header = document.querySelector('.topbar');
      const language = document.querySelector('#rupaykg-national-language-selector');
      if (header && language?.parentElement === header) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  })()`);
  assert.equal(pageReady, true, "React header and language selector must mount before interaction tests");

  const initial = await evaluate(`({
    drawer: !!document.querySelector('[role="dialog"]'),
    health: !!document.querySelector('.health'),
    languageInHeader: document.querySelector('#rupaykg-national-language-selector')?.parentElement?.classList.contains('topbar') === true,
    offlineHidden: document.querySelector('#rupaykg-offline-status')?.hidden === true
  })`);
  assert.equal(initial.drawer, false, "account drawer must start closed");
  assert.equal(initial.health, false, "anonymous visitor must not see internal health diagnostics");
  assert.equal(initial.languageInHeader, true, "language selector must be inside the responsive header");
  assert.equal(initial.offlineHidden, true, "empty offline status must remain hidden");

  await command("Emulation.setDeviceMetricsOverride", { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  const narrowViewport = await evaluate(`(async()=> {
    await new Promise(resolve => setTimeout(resolve, 80));
    return { width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth };
  })()`);
  assert.ok(narrowViewport.scrollWidth <= narrowViewport.width, "320px viewport must not have horizontal overflow");
  await command("Emulation.clearDeviceMetricsOverride");

  const signIn = await evaluate(`(async()=> {
    document.querySelector('.landing-actions button')?.click();
    ${waitForRender}
    return {
      drawer: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
      modal: document.querySelector('[role="dialog"]')?.getAttribute("aria-modal") === "true",
      focusInside: document.querySelector('[role="dialog"]')?.contains(document.activeElement) === true,
      email: !!document.querySelector('[role="dialog"] input[aria-label="Email"]')
    };
  })()`);
  assert.equal(signIn.drawer, true, "Sign in CTA must open an accessible dialog");
  assert.equal(signIn.modal, true, "Account access must be announced as modal");
  assert.equal(signIn.focusInside, true, "Opening account access must move focus into the dialog");
  assert.equal(signIn.email, true, "Sign in panel must expose a programmatically labelled email field");
  const trapped = await evaluate(`(async()=> {
    const panel = document.querySelector('[role="dialog"]');
    const items = [...panel.querySelectorAll('button:not([disabled]),input:not([disabled])')];
    items[items.length - 1].focus();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    return panel.contains(document.activeElement) && document.activeElement === items[0];
  })()`);
  assert.equal(trapped, true, "Tab from the last control must wrap to the first dialog control");

  const escaped = await evaluate(`(async()=> {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ${waitForRender}
    return !document.querySelector('[role="dialog"]') && document.activeElement === document.querySelectorAll(".landing-actions button")[0];
  })()`);
  assert.equal(escaped, true, "Escape must close account access");

  const register = await evaluate(`(async()=> {
    document.querySelectorAll('.landing-actions button')[1]?.click();
    ${waitForRender}
    const panel = document.querySelector('[role="dialog"][aria-modal="true"]');
    return {
      drawer: !!panel,
      name: !!panel?.querySelector('input[aria-label="Name"]'),
      focusInside: panel?.contains(document.activeElement) === true
    };
  })()`);
  assert.equal(register.drawer, true, "Create account CTA must open account access");
  assert.equal(register.name, true, "Create account panel must expose the labelled name field");
  assert.equal(register.focusInside, true, "Registration dialog must receive focus on open");

  const closed = await evaluate(`(async()=> {
    document.querySelector('[aria-label="Close account access"]')?.click();
    ${waitForRender}
    return !document.querySelector('[role="dialog"]') && document.activeElement === document.querySelectorAll(".landing-actions button")[1];
  })()`);
  assert.equal(closed, true, "Close control must dismiss account access");

  console.log("RupayKg landing interaction checks passed: sign-in, registration, Escape, close, language docking and anonymous-state hygiene.");
} finally {
  try { socket?.close(); } catch {}
  chrome.kill("SIGTERM");
}
