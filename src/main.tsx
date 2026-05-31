import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import SetupScreen from "./components/SetupScreen";
import "./index.css";

const isSetup = new URLSearchParams(window.location.search).get("setup") === "1";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        {isSetup ? <SetupScreen /> : <App />}
    </React.StrictMode>,
);
