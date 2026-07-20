// ============================================================
// Firebase setup.
// >>> PASTE YOUR CONFIG BELOW — replace the whole object. <<<
// Get it from: Firebase console → Project settings (gear icon)
// → Your apps → SDK setup and configuration → Config
// This config is safe to publish; security lives in your
// database rules, not in hiding these values.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, get, update, onValue, onDisconnect, remove,
  serverTimestamp, child, push,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
};

export const configLooksReal =
  !firebaseConfig.apiKey.startsWith("PASTE_") &&
  firebaseConfig.databaseURL.startsWith("https://") &&
  !firebaseConfig.databaseURL.includes("PASTE_");

let db = null;
if (configLooksReal) {
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export { db, ref, set, get, update, onValue, onDisconnect, remove, serverTimestamp, child, push };

export function roomRef(code, path = "") {
  return ref(db, `rooms/${code}${path ? "/" + path : ""}`);
}

// Show a friendly banner if the config hasn't been pasted in yet
export function warnIfUnconfigured() {
  if (configLooksReal) return false;
  const el = document.createElement("div");
  el.className = "error-banner";
  el.textContent =
    "Firebase isn't configured yet. Open js/firebase.js and paste in your project's config object (Firebase console → Project settings → Your apps).";
  document.body.prepend(el);
  return true;
}
