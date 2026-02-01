// qa_generate.js
import { UI_FLAGS } from "./lib/env.js";
import { watchAuth } from "./lib/ank_firebase.js";
import { getUserContext } from "./lib/user_context.js";

const $ = (id) => document.getElementById(id);

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function setStatus(msg, isError = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.className = isError ? "err" : "";
}

function toLogin() {
  const rt = location.pathname + location.search;
  const url = new URL("./login.html", location.href);
  url.searchParams.set("return_to", rt);
  location.replace(url.toString());
}

function fill(ctx) {
  $("user_id").textContent = ctx?.user_id ?? "-";
  $("account_id").textContent = ctx?.account_id ?? "-";
  $("tenant_id").textContent = ctx?.tenant_id ?? "-";
  $("plan_id").textContent = ctx?.plan_id ?? "-";

  // デバッグ表示（不要なら消してOK）
  if ($("raw")) $("raw").textContent = JSON.stringify(ctx, null, 2);
}

async function load() {
  setStatus("checking auth...");

  watchAuth(async (user) => {
    if (!user) {
      setStatus("not logged in -> login");
      toLogin();
      return;
    }

    try {
      setStatus("loading user context...");
      const ctx = await getUserContext(); // ★共通化された取得
      debug("[ctx]", ctx);
      fill(ctx);
      setStatus("ok");
    } catch (e) {
      console.error(e);
      setStatus(`error: ${String(e?.message || e)}`, true);
      if ($("raw") && e?.bodyText) $("raw").textContent = e.bodyText;
    }
  });
}

$("btnReload")?.addEventListener("click", () => location.reload());

load();
