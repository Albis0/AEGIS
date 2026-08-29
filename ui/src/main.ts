import { mount } from "svelte";
import App from "./App.svelte";
import "./styles.css";

// The theme is applied before the app mounts, not from an effect inside it.
//
// Components read `data-theme` as they initialise -- the reactor builds a
// whole environment map from it -- and a child's `onMount` runs before the
// parent's `$effect`, so setting it there means every child initialises
// against the wrong theme and has to be corrected afterwards. Doing it here
// also removes the flash of the wrong background on a light-theme start.
const savedTheme = localStorage.getItem("vavis.theme");
document.documentElement.dataset.theme =
    savedTheme === "light" ? "light" : "dark";

const target = document.getElementById("app");
if (!target) {
    throw new Error("mount point #app is missing from index.html");
}

export default mount(App, { target });
