import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LoginGate from "./LoginGate";
import "./styles.css";

function Root() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(sessionStorage.getItem("rupaykg.sessionToken")));
  return authenticated ? <App /> : <LoginGate onAuthenticated={() => setAuthenticated(true)} />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
