// login.js
import { UI_FLAGS, UI_META } from "./lib/env.js";
import { watchAuth, loginWithGooglePopup } from "./lib/ank_firebase.js";

const $ = (id) => document.getElementById(id);

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function setStatus(msg, kind = "ok") {
  const el = $("status");
  el.textContent = msg || "";
  el.dataset.kind = kind;
}

function getReturnTo() {
  const u = new URL(location.href);
  const rt = (u.searchParams.get("return_to") || "").trim();
  return rt || "./";
}

function safeReturnTo(rt) {
  // login.html に戻すとループするので潰す
  if (rt.includes("login.html")) return "./";
  return rt;
}

function goBack() {
  const rt = safeReturnTo(getReturnTo());
  location.replace(rt);
}

$("who").textContent = UI_META?.APP_NAME || "ank-ui";
$("sub").textContent = "";
setStatus("waiting...");

$("btnLogin").addEventListener("click", async () => {
  try {
    setStatus("logging in...");
    await loginWithGooglePopup();
    // 成功したら watchAuth 側で goBack() が呼ばれる
  } catch (e) {
    console.error(e);
    setStatus(String(e?.message || e), "error");
  }
});

watchAuth((user) => {
  if (!user) {
    debug("[login] not logged in");
    setStatus("not logged in");
    $("sub").textContent = "ボタンを押してログインしてください。";
    return;
  }

  debug("[login] logged in:", user.email);
  setStatus("logged in");
  $("sub").textContent = user.email || "";

  // ログイン済みになったら戻す
  goBack();
});
