// lib/api.js
// API呼び出しの共通化
// ・API_BASE へのfetch
// ・Authorization: Bearer <idToken> を付与
// ・JSON/テキストの両対応
// ・エラー整形（detail/message を優先）
// ※ 画面遷移やアプリ判定ロジックは禁止

import { API_BASE, UI_FLAGS } from "./env.js";
import { getIdToken } from "./ank_firebase.js";

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  if (!p.startsWith("/")) return b + "/" + p;
  return b + p;
}

function debugLog(...args) {
  if (UI_FLAGS?.DEBUG_LOG) console.log(...args);
}

async function readBody(res) {
  // まず text として読み、必要なら JSON parse
  const text = await res.text();
  if (!text) return { rawText: "", data: null };

  try {
    const data = JSON.parse(text);
    return { rawText: text, data };
  } catch {
    return { rawText: text, data: null };
  }
}

function pickErrorMessage(res, parsed) {
  // APIが返しがちな形を優先して拾う
  const data = parsed?.data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.message === "string" && data.message.trim()) return data.message;

    // detail が配列/オブジェクトのこともある（FastAPIでよくある）
    if (data.detail != null) {
      try {
        return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      } catch {
        // noop
      }
    }
  }

  // fallback
  return `HTTP ${res.status} ${res.statusText || ""}`.trim();
}

async function authHeader() {
  const token = await getIdToken(false);
  if (!token) throw new Error("not logged in");
  return { Authorization: `Bearer ${token}` };
}

/**
 * API呼び出し（JSONを返す想定）
 * @param {string} path "/v1/..." など
 * @param {{
 *   method?: string,
 *   headers?: Record<string,string>,
 *   body?: any,
 *   requireAuth?: boolean,
 * }} opts
 */
export async function apiFetch(path, opts = {}) {
  const {
    method = "GET",
    headers = {},
    body = undefined,
    requireAuth = true,
  } = opts;

  const url = joinUrl(API_BASE, path);

  const finalHeaders = {
    ...(requireAuth ? await authHeader() : {}),
    ...headers,
  };

  // body があるときだけ Content-Type を付ける
  const hasBody = body !== undefined && body !== null && method.toUpperCase() !== "GET";
  if (hasBody && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  debugLog("[apiFetch]", method, url);

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const parsed = await readBody(res);

  if (!res.ok) {
    const msg = pickErrorMessage(res, parsed);
    const err = new Error(msg);
    err.status = res.status;
    err.url = url;
    err.bodyText = parsed.rawText;
    throw err;
  }

  // JSON が取れたらそれ、取れなければ rawText を返す
  if (parsed.data !== null) return parsed.data;
  return { raw: parsed.rawText };
}

/**
 * GET with query params
 * @param {string} path
 * @param {Record<string, string | number | boolean | null | undefined>} query
 */
export function buildQuery(path, query = {}) {
  const u = new URL(joinUrl(API_BASE, path));
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined) continue;
    u.searchParams.set(k, String(v));
  }
  // API_BASE を含む absolute になるので、ここでは pathname+search を返す用途もある
  // ただ、apiFetchに渡すなら absolute は不要なので path+search を返す
  return u.pathname + u.search;
}

/**
 * JSON POST を簡単に呼ぶユーティリティ
 */
export async function apiPost(path, body, opts = {}) {
  return apiFetch(path, { ...opts, method: "POST", body });
}
