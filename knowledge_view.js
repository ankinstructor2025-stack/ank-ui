console.log("knowledge_view.js loaded");

const btnReload = document.getElementById("btnReload");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const parentTableHead = document.getElementById("parentTableHead");
const parentTableBody = document.getElementById("parentTableBody");
const childTableHead = document.getElementById("childTableHead");
const childTableBody = document.getElementById("childTableBody");

const detailPre = document.getElementById("detailPre");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let parentRows = [];
let childRows = [];
let selectedParentJobId = "";
let selectedChildJobItemId = "";
let checkedChildIds = new Set();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getIdToken() {
  return sessionStorage.getItem("idToken");
}

function requireIdToken() {
  const idToken = getIdToken();
  if (!idToken) {
    throw new Error("ログイン情報が見つかりません");
  }
  return idToken;
}

async function apiGet(path, query = {}) {
  const idToken = requireIdToken();
  const url = new URL(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`);

  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    let detail = `APIエラー (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch (_) {}
    throw new Error(detail);
  }

  return await res.json();
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "ready" || s === "done" || s === "normalized" || s === "vectorized") {
    return "status-pill status-done";
  }
  if (s === "error" || s === "failed") {
    return "status-pill status-error";
  }
  return "status-pill status-new";
}

function getNextAction(status) {
  const s = String(status || "").toLowerCase();

  if (s === "new" || s === "ready") {
    return { label: "正規化", action: "normalize" };
  }

  if (s === "normalized" || s === "normalize_done") {
    return { label: "ベクトル化", action: "vectorize" };
  }

  if (s === "vectorized" || s === "vectorize_done") {
    return { label: "重複削除", action: "dedup" };
  }

  return null;
}

function renderParentPlaceholder(message) {
  parentTableHead.innerHTML = "";
  parentTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderChildPlaceholder(message) {
  childTableHead.innerHTML = "";
  childTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function resetScreen() {
  renderParentPlaceholder("読み込み中です.");
  renderChildPlaceholder("親を選択してください。");
  summaryText.textContent = "0 件";
  selectionSummary.textContent = "選択 0 件";
  contextSummary.textContent = "親一覧";
  detailPre.textContent = "読み込み中です.";
  childRows = [];
  selectedParentJobId = "";
  selectedChildJobItemId = "";
  checkedChildIds = new Set();
}

function updateSelectionSummary() {
  selectionSummary.textContent = `選択 ${checkedChildIds.size} 件`;
}

async function executeParentAction(jobId, actionName) {
  const row = parentRows.find((x) => x.job_id === jobId);
  if (!row) {
    alert("job が見つかりません。");
    return;
  }

  const actionLabel =
    actionName === "normalize" ? "正規化" :
    actionName === "vectorize" ? "ベクトル化" :
    actionName === "dedup" ? "重複削除" :
    "処理";

  alert(`${actionLabel} API は次段階で接続します。\njob_id: ${jobId}`);
}

function buildParentDetailText(row) {
  const lines = [];

  lines.push(`job_id: ${row?.job_id ?? ""}`);
  lines.push(`source_type: ${row?.source_type ?? ""}`);
  lines.push(`source_name: ${row?.source_name ?? ""}`);
  lines.push(`request_type: ${row?.request_type ?? ""}`);
  lines.push(`status: ${row?.status ?? ""}`);
  lines.push(`selected_count: ${row?.selected_count ?? 0}`);
  lines.push(`qa_count: ${row?.qa_count ?? 0}`);
  lines.push(`plain_count: ${row?.plain_count ?? 0}`);
  lines.push(`error_count: ${row?.error_count ?? 0}`);
  lines.push(`started_at: ${row?.started_at ?? ""}`);
  lines.push(`finished_at: ${row?.finished_at ?? ""}`);
  lines.push(`error_message: ${row?.error_message ?? ""}`);

  const nextAction = getNextAction(row?.status);
  if (nextAction) {
    lines.push(`next_action: ${nextAction.label}`);
  }

  return lines.join("\n");
}

function buildChildDetailText(row) {
  const lines = [];

  lines.push(`job_item_id: ${row?.job_item_id ?? ""}`);
  lines.push(`job_id: ${row?.job_id ?? ""}`);
  lines.push(`source_item_id: ${row?.source_item_id ?? ""}`);
  lines.push(`source_type: ${row?.source_type ?? ""}`);
  lines.push(`title: ${row?.title ?? ""}`);
  lines.push(`status: ${row?.status ?? ""}`);
  lines.push(`qa_count: ${row?.qa_count ?? 0}`);
  lines.push(`plain_count: ${row?.plain_count ?? 0}`);
  lines.push(`error_count: ${row?.error_count ?? 0}`);
  lines.push(`requested_at: ${row?.requested_at ?? ""}`);
  lines.push(`started_at: ${row?.started_at ?? ""}`);
  lines.push(`finished_at: ${row?.finished_at ?? ""}`);
  lines.push(`error_message: ${row?.error_message ?? ""}`);

  return lines.join("\n");
}

function loadDetailFromParent(jobId) {
  const row = parentRows.find((x) => x.job_id === jobId);
  if (!row) {
    detailPre.textContent = "job が見つかりません。";
    return;
  }
  detailPre.textContent = buildParentDetailText(row);
}

function loadDetailFromChild(jobItemId) {
  const row = childRows.find((x) => String(x.job_item_id) === String(jobItemId));
  if (!row) {
    detailPre.textContent = "job_item が見つかりません。";
    return;
  }
  detailPre.textContent = buildChildDetailText(row);
}

function renderParentTable(rows) {
  parentTableHead.innerHTML = `
    <tr>
      <th>source_type</th>
      <th>status</th>
      <th>selected</th>
      <th>qa</th>
      <th>plain</th>
      <th>処理</th>
    </tr>
  `;

  if (!rows.length) {
    renderParentPlaceholder("job がありません。");
    return;
  }

  parentTableBody.innerHTML = rows.map((row) => {
    const nextAction = getNextAction(row.status);
    const actionButton =
