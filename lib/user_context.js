// user_context.js
import { apiFetch } from "./api.js";

export async function fetchSession() {
  // ★GET を明示（事故防止）
  const res = await apiFetch("/v1/session", { method: "GET" });

  // apiFetch は基本 JSON を返すが、ここで “型” を固定しておく
  if (!res || typeof res !== "object") {
    throw new Error("session response is not JSON object");
  }

  return res;
}

export function normalizeSession(session) {
  // ここはあなたのUI表示に合わせて “そのまま”
  // （必要ならあなたの既存キーに合わせて調整する）
  const user_id = session.user_id || session.uid || "-";
  const account_id = session.account_id || "-";
  const tenant_id = session.tenant_id || "-";
  const plan_id = session.plan_id || "-";

  return { user_id, account_id, tenant_id, plan_id, me_raw: session };
}
