import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Pratham from "./apps/Pratham";
import { isLearnPath } from "./lib/published/route";

// Phase G2: the student reader is a SEPARATE full-page experience. Branch on the
// path before mount so /learn gets PRATHAM (no operator OS-shell chrome) while
// every other path keeps the existing operator console.
const Root = isLearnPath(window.location.pathname) ? Pratham : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
