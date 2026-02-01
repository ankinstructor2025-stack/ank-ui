// qa_generate.js
import { API_BASE, UI_FLAGS } from "./lib/env.js";
import { watchAuth, getIdToken } from "./lib/ank_firebase.js";

const $ = (id) => document.getElementById(id);

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg || "";
  el.className = isError ? "err" : "";
}

function getCurrentPathWithQuery() {
  return location.pathname + location.search;
}

function toLogin() {
  const rt = getCurrentPathWithQuery();
  const url = new URL("./login.html", location.href);
  url.searchParams.set("return_to", rt);
  location.replace(url.toString());
}

async function apiGetJson(path) {
  const token = await getIdToken(false);
  if (!token) throw new Error("not logged in");

  const res = await fetch(API_BASE + path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }

  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) ? (data.detail || data.message) : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.bodyText = text;
    throw err;
  }
  return data;
}

function fillIds({ user_id, account_id, tenant_id, plan_id }) {
  if (user_id != null) $("user_id").textContent = String(user_id);
  if (account_id != null) $("account_id").textContent = String(account_id);
  if (tenant_id != null) $("tenant_id").textContent = String(tenant_id);
  if (plan_id != null) $("plan_id").textContent = String(plan_id);
}

/**
 * ★ここが唯一の「あなたのAPIに依存する」部分
 * 例:
 * - /v1/account/me
 * - /v1/account/resolve
 * - /v1/me
 * など、実際に存在するものに合わせて変える
 */
const ME_ENDPOINT = "/v1/account/me";

async function load() {
  $("raw").textContent = "";
  setStatus("checking auth...");

  // watchAuth で「ログイン済みの時だけ」取得する
  // (未ログインでAPI叩かない)
  watchAuth(async (user) => {
    if (!user) {
      debug("[qa_generate] not logged in -> login");
      setStatus("not logged in. redirecting to login...");
      toLogin();
      return;
    }

    // 1) user_id は UIだけで確定できる
    fillIds({ user_id: user.uid });

    // 2) account/tenant/plan は API から取る（取れなければ未取得のまま）
    setStatus("loading user state from API...");
    try {
      const me = await apiGetJson(ME_ENDPOINT);
      debug("[me]", me);
      $("raw").textContent = JSON.stringify(me, null, 2);

      // よくある形を複数パターンで拾う（落ちないように）
      const account_id =
        me?.account_id ?? me?.account?.account_id ?? me?.account?.id ?? null;
      const tenant_id =
        me?.tenant_id ?? me?.tenant?.tenant_id ?? me?.tenant?.id ?? null;
      const plan_id =
        me?.plan_id ?? me?.plan?.plan_id ?? me?.plan?.id ?? null;

      fillIds({ account_id, tenant_id, plan_id });

      setStatus("ok");
    } catch (e) {
      console.error(e);
      setStatus(`API error: ${String(e?.message || e)}`, true);
      // raw にも残す
      if (e?.bodyText) $("raw").textContent = e.bodyText;
    }
  });
}

$("btnReload").addEventListener("click", async () => {
  // 画面をそのまま再取得
  location.reload();
});

load();
