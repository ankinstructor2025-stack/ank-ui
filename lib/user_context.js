// lib/user_context.js
import { apiFetch } from "./api.js";
import { getCurrentUser } from "./ank_firebase.js";

export async function getUserContext() {
  const u = getCurrentUser();
  if (!u) throw new Error("not logged in");

  const s = await apiFetch("/v1/session", { method: "GET" });

  // 画面が使う“正規化済み”の最小形
  const ctx = {
    user_id: u.uid,
    email: u.email || null,
    account_id: s?.account_id ?? null,
    tenant_id: s?.tenant_id ?? null,
    qa_only: !!s?.qa_only,
  };

  return ctx;
}

export default getUserContext;
