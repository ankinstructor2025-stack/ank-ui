// login.js
import { UI_FLAGS, UI_META } from "./lib/env.js";
import { watchAuth, loginWithGoogle } from "./lib/ank_firebase.js";

const $ = (id) => document.getElementById(id);

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function setStatus(msg, kind = "ok") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.dataset.kind = kind;
}

function getReturnTo() {
  const u = new URL(location.href);
  return u.searchParams.get("return_to") || "./";
}

function safeReturnTo(rt) {
  if (rt.includes("login.html")) return "./";
  return rt;
}

function goBack() {
  const rt = safeReturnTo(getReturnTo());
  location.replace(rt);
}

// 「この画面でログイン操作を開始したか」フラグ
const INTENT_KEY = "ank_login_intent";

// 初期表示
$("who").textContent = UI_META?.APP_NAME || "ank-ui";
$("sub").textContent = "";
setStatus("未ログイン");

// ★ ボタンでログイン
$("btnLogin").addEventListener("click", async () => {
  try {
    // ここで「ログイン開始」を記録
    sessionStorage.setItem(INTENT_KEY, "1");

    setStatus("ログイン中…");
    await loginWithGoogle();   // 成功後は watchAuth が反応する
  } catch (e) {
    console.error(e);
    sessionStorage.removeItem(INTENT_KEY);
    setStatus(String(e?.message || e), "error");
  }
});

// 認証状態監視
watchAuth((user) => {
  if (!user) {
    debug("[login] not logged in");
    $("sub").textContent = "Googleでログインしてください。";
    return;
  }

  debug("[login] logged in:", user.email);
  setStatus("ログイン成功");
  $("sub").textContent = user.email || "";

  // ★ 勝手に戻らない。ボタンから開始した時だけ戻る。
  const intent = sessionStorage.getItem(INTENT_KEY) === "1";
  if (intent) {
    sessionStorage.removeItem(INTENT_KEY);
    goBack();
  } else {
    // 既にログイン済みでこの画面を開いたケース
    $("sub").textContent = `${user.email || ""}（ログイン済み）`;
    // ここで自動遷移はしない
  }
});
