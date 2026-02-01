// api.js
import { API_BASE, UI_FLAGS } from "./env.js";
import { getIdTokenOrNull } from "./ank_firebase.js";

function debug(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

function normalizeMethod(method) {
  const m = String(method || "GET").toUpperCase().trim();
  return m || "GET";
}

async function readBodySafe(res, method) {
  const m = normalizeMethod(method);

  // プリフライトの正解は 204 No Content（本文なし）
  // ここで本文を読みに行くと “それっぽいJSON” を拾う事故が起きる
  if (m === "HEAD" || res.status === 204 || res.status === 205) {
    return null;
  }

  // 空本文も null 扱い
  const text = await res.text();
  if (!text) return null;

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // Content-Type が JSON のときだけ JSON として扱う
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // JSON壊れてたら text のまま返す（落とさない）
      return { _raw_text: text, _json_parse_error: String(e?.message || e) };
    }
  }

  // JSON じゃないなら text を返す（勝手にJSON認定しない）
  return text;
}

export async function apiFetch(path, opts = {}) {
  const method = normalizeMethod(opts.method || "GET");

  // ★爆弾除去：アプリコードから OPTIONS を呼ぶのは禁止
  // （プリフライトはブラウザが自動でやる）
  if (method === "OPTIONS") {
    throw new Error(
      "apiFetch must not call OPTIONS. Preflight is browser-managed."
    );
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");

  // Body を送る場合だけ Content-Type を付ける（GET では付けない）
  const hasBody = opts.body !== undefined && opts.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // 認証トークン（存在する場合だけ）
  const token = await getIdTokenOrNull();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOpts = {
    method,
    headers,
    mode: "cors",
    credentials: "omit",
  };

  if (hasBody) {
    fetchOpts.body =
      typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  debug("[apiFetch]", method, url);

  const res = await fetch(url, fetchOpts);

  const data = await readBodySafe(res, method);

  // 失敗は detail を優先して投げる
  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && data.detail) ||
      (typeof data === "string" ? data : null) ||
      `HTTP ${res.status}`;
    throw new Error(detail);
  }

  return data;
}
