// index.js
import { UI_META, UI_FLAGS } from "./lib/env.js";
import { watchAuth, loginWithGoogle, logout } from "./lib/ank_firebase.js";

const $ = (id) => document.getElementById(id);

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function setStatus(message, kind = "ok") {
  const el = $("status");
  if (!el) return;
  el.className = `status ${kind}`;
  el.style.display = "block";
  el.textContent = message || "";
}

function clearStatus() {
  const el = $("status");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
  el.className = "status";
}

function setLoggedOutUI() {
  $("who").textContent = `${UI_META?.APP_NAME || "ank-ui"}：未ログイン`;
  $("sub").textContent = "Googleでログインしてください。";
  $("btnLogout").disabled = false;
  $("btnLogout").textContent = "ログイン";
}

function setLoggedInUI(user) {
  const email = user?.email || "(no email)";
  $("who").textContent = `${UI_META?.APP_NAME || "ank-ui"}：ログイン済み`;
  $("sub").textContent = email;
  $("btnLogout").disabled = false;
  $("btnLogout").textContent = "ログアウト";
}

async function onPrimaryButtonClick() {
  clearStatus();

  const mode = $("btnLogout").textContent || "";
  const isLogin = mode.includes("ログイン");

  try {
    if (isLogin) {
      setStatus("ログイン中…", "ok");
      await loginWithGoogle();
      clearStatus();
      return;
    }

    setStatus("ログアウト中…", "ok");
    await logout();
    clearStatus();
  } catch (e) {
    console.error(e);
    setStatus(String(e?.message || e), "error");
  }
}

function init() {
  $("btnLogout").addEventListener("click", onPrimaryButtonClick);

  watchAuth((user) => {
    debug("[auth]", user ? `logged in: ${user.email}` : "logged out");
    clearStatus();

    if (!user) {
      setLoggedOutUI();
      return;
    }
    setLoggedInUI(user);
  });
}

init();
