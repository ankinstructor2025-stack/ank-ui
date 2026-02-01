// lib/user_context.js
import { apiFetch } from "./api.js";
import { getCurrentUser } from "./ank_firebase.js";

export async function getUserContext() {
  const u = getCurrentUser();
  if (!u) throw new Error("not logged in");

  const me = await apiFetch("/v1/session", { method: "GET" });

  return {
    user_id: u.uid,
    email: u.email || null,
    account_id: me?.account_id ?? null,
    tenant_id: me?.tenant_id ?? null,
    plan_id: me?.plan_id ?? null,
    me_raw: me,
  };
}

// 保険：default importでも動く
export default getUserContext;
