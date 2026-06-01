import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Onboarding from "./components/Onboarding";
import "./index.css";

const isSetup =
    new URLSearchParams(window.location.search).get("setup") === "1" ||
    window.location.hash.replace(/^#/, "") === "setup";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        {isSetup ? <Onboarding /> : <App />}
    </React.StrictMode>,
);
