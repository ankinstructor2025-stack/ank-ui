// lib/user_context.js
import { apiFetch } from "./api.js";
import { getCurrentUser } from "./firebase_auth.js"; // ←あなたの実ファイル名に合わせる

// ★ここだけあなたのAPIに合わせる
const ME_ENDPOINT = "/v1/account/me";

export async function getUserContext() {
  const u = getCurrentUser();
  if (!u) throw new Error("not logged in");

  // user_id は Firebase で確定
  const base = {
    user_id: u.uid,
    email: u.email || null,
  };

  // account/tenant/plan は API から取得
  const me = await apiFetch(ME_ENDPOINT);

  return {
    ...base,
    account_id: me?.account_id ?? me?.account?.id ?? null,
    tenant_id: me?.tenant_id ?? me?.tenant?.id ?? null,
    plan_id: me?.plan_id ?? me?.plan?.id ?? null,
    me_raw: me, // デバッグ用（不要なら消してOK）
  };
}
