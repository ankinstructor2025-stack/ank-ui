// qa_generate.js
import { UI_FLAGS } from "./lib/env.js";
import { watchAuth } from "./lib/ank_firebase.js";
import { apiFetch } from "./lib/api.js";

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

function normalizeCtx(user, s) {
  // 画面が使う最小の形に正規化（機能は減らさない）
  const user_id = s?.user_id ?? s?.uid ?? user?.uid ?? "-";
  const account_id = s?.account_id ?? "-";

  // tenant_id は /v1/session が返せない場合、tenantsが1件なら補完
  let tenant_id = s?.tenant_id ?? null;
  if (!tenant_id && Array.isArray(s?.tenants) && s.tenants.length === 1) {
    tenant_id = s.tenants[0]?.tenant_id ?? null;
  }

  // plan_id は基本返さない方針でも表示欄は残す（qa_onlyならbasic表示）
  let plan_id = s?.plan_id ?? null;
  if (!plan_id && s?.qa_only === true) {
    plan_id = "basic";
  }

  return {
    user_id,
    account_id,
    tenant_id: tenant_id ?? "-",
    plan_id: plan_id ?? "-",
    // raw表示用（今の画面の機能として残す）
    _raw_session: s ?? null,
  };
}

function fill(ctx) {
  $("user_id").textContent = ctx?.user_id ?? "-";
  $("account_id").textContent = ctx?.account_id ?? "-";
  $("tenant_id").textContent = ctx?.tenant_id ?? "-";
  $("plan_id").textContent = ctx?.plan_id ?? "-";

  // raw表示（機能は維持）
  if ($("raw")) {
    // _raw_session があればそれを見せる（/v1/sessionの生）
    const raw = ctx?._raw_session ?? ctx;
    $("raw").textContent = JSON.stringify(raw, null, 2);
  }
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
      setStatus("loading session...");
      const s = await apiFetch("/v1/session", { method: "GET" });
      const ctx = normalizeCtx(user, s);
      debug("[session]", s);
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
