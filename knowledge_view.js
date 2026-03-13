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
    throw new Error("ログイン情報が見つかりません。再ログインしてください。");
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
      if (data?.detail) {
        detail = data.detail;
      }
    } catch (_) {}
    throw new Error(detail);
  }

  return await res.json();
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (["ready", "done", "normalized", "normalize_done", "vectorized", "vectorize_done"].includes(s)) {
    return "status-pill status-done";
  }
  if (["error", "failed"].includes(s)) {
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
  parentTableHead.innerHTML = `<tr><th>message</th></tr>`;
  parentTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderChildPlaceholder(message) {
  childTableHead.innerHTML = `<tr><th>message</th></tr>`;
  childTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function resetScreen() {
  renderParentPlaceholder("親一覧を読み込み中です...");
  renderChildPlaceholder("親を選択してください。");
  summaryText.textContent = "0 件";
  selectionSummary.textContent = "選択 0 件";
  contextSummary.textContent = "親一覧";
  detailPre.textContent = "親一覧を読み込み中です...";
  parentRows = [];
  childRows = [];
  selectedParentJobId = "";
  selectedChildJobItemId = "";
}

function updateSelectionSummary() {
  selectionSummary.textContent = childRows.length > 0
    ? `子 ${childRows.length} 件`
    : "選択 0 件";
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
  lines.push(`status: ${row?.status ?? ""}`);
  lines.push(`row_no: ${row?.row_no ?? ""}`);
  lines.push(`question: ${row?.question ?? ""}`);
  lines.push(`answer: ${row?.answer ?? ""}`);
  lines.push(`plain_text: ${row?.plain_text ?? ""}`);
  lines.push(`error_message: ${row?.error_message ?? ""}`);
  return lines.join("\n");
}

function loadDetailFromParent(jobId) {
  const row = parentRows.find((x) => x.job_id === jobId);
  detailPre.textContent = row ? buildParentDetailText(row) : "job が見つかりません。";
}

function loadDetailFromChild(jobItemId) {
  const row = childRows.find((x) => x.job_item_id === jobItemId);
  detailPre.textContent = row ? buildChildDetailText(row) : "job_item が見つかりません。";
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
    const actionButton = nextAction
      ? `<button type="button" class="btn btn-primary parent-action-btn" data-job-id="${escapeHtml(row.job_id)}" data-action="${escapeHtml(nextAction.action)}">${escapeHtml(nextAction.label)}</button>`
      : `<span class="muted-text">-</span>`;

    return `
      <tr class="clickable-row ${row.job_id === selectedParentJobId ? "selected-row" : ""}" data-job-id="${escapeHtml(row.job_id)}">
        <td>${escapeHtml(row.source_type ?? "")}</td>
        <td><span class="${getStatusClass(row.status)}">${escapeHtml(row.status ?? "")}</span></td>
        <td>${escapeHtml(row.selected_count ?? 0)}</td>
        <td>${escapeHtml(row.qa_count ?? 0)}</td>
        <td>${escapeHtml(row.plain_count ?? 0)}</td>
        <td>${actionButton}</td>
      </tr>
    `;
  }).join("");

  parentTableBody.querySelectorAll("tr[data-job-id]").forEach((tr) => {
    tr.addEventListener("click", async () => {
      selectedParentJobId = tr.dataset.jobId || "";
      selectedChildJobItemId = "";
      renderParentTable(parentRows);
      loadDetailFromParent(selectedParentJobId);
      await loadChildRows(selectedParentJobId);
    });
  });

  parentTableBody.querySelectorAll(".parent-action-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const jobId = btn.dataset.jobId || "";
      const actionName = btn.dataset.action || "";
      await executeParentAction(jobId, actionName);
    });
  });
}

function renderChildTable(rows) {
  childTableHead.innerHTML = `
    <tr>
      <th>status</th>
      <th>source_item_id</th>
      <th>row_no</th>
    </tr>
  `;

  if (!rows.length) {
    renderChildPlaceholder("子データがありません。");
    return;
  }

  childTableBody.innerHTML = rows.map((row) => `
    <tr class="clickable-row ${row.job_item_id === selectedChildJobItemId ? "selected-row" : ""}" data-job-item-id="${escapeHtml(row.job_item_id)}">
      <td><span class="${getStatusClass(row.status)}">${escapeHtml(row.status ?? "")}</span></td>
      <td>${escapeHtml(row.source_item_id ?? "")}</td>
      <td>${escapeHtml(row.row_no ?? "")}</td>
    </tr>
  `).join("");

  childTableBody.querySelectorAll("tr[data-job-item-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      selectedChildJobItemId = tr.dataset.jobItemId || "";
      renderChildTable(childRows);
      loadDetailFromChild(selectedChildJobItemId);
    });
  });
}

async function loadParentRows() {
  resetScreen();

  try {
    const data = await apiGet("/knowledge/refine/jobs");
    parentRows = Array.isArray(data?.jobs) ? data.jobs : [];

    summaryText.textContent = `${parentRows.length} 件`;
    contextSummary.textContent = "親一覧: knowledge_jobs";
    renderParentTable(parentRows);

    renderChildPlaceholder("親を選択してください。");
    detailPre.textContent = parentRows.length
      ? "親一覧から1件選択してください。"
      : "job がありません。";
  } catch (err) {
    console.error("loadParentRows error:", err);
    renderParentPlaceholder(err.message || "読み込みに失敗しました。");
    renderChildPlaceholder("読み込みに失敗しました。");
    detailPre.textContent = err.message || "読み込みに失敗しました。";
  }
}

async function loadChildRows(jobId) {
  renderChildPlaceholder("子一覧を読み込み中です...");
  childRows = [];
  updateSelectionSummary();

  try {
    const data = await apiGet("/knowledge/refine/job-items", { job_id: jobId });
    childRows = Array.isArray(data?.job_items) ? data.job_items : [];
    renderChildTable(childRows);
    updateSelectionSummary();

    if (!childRows.length) {
      detailPre.textContent = buildParentDetailText(parentRows.find((x) => x.job_id === jobId));
    }
  } catch (err) {
    console.error("loadChildRows error:", err);
    renderChildPlaceholder(err.message || "子一覧の読み込みに失敗しました。");
    updateSelectionSummary();
  }
}

function bindEvents() {
  btnReload?.addEventListener("click", async () => {
    await loadParentRows();
  });

  btnMenu?.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout?.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    window.location.href = "./index.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindEvents();
    await loadParentRows();
  } catch (err) {
    console.error("DOMContentLoaded error:", err);
    detailPre.textContent = err.message || "初期化に失敗しました。";
  }
});
