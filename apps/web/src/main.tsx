import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LoginGate from "./LoginGate";
import "./styles.css";
import "./login.css";

function Root() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(sessionStorage.getItem("rupaykg.sessionToken")));

  if (!authenticated) {
    return <LoginGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
