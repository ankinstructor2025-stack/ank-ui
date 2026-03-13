console.log("knowledge_view.js loaded");

const btnReload = document.getElementById("btnReload");
const btnExecute = document.getElementById("btnExecute");
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
  if (s === "ready" || s === "done") return "status-pill status-done";
  if (s === "error") return "status-pill status-error";
  return "status-pill status-new";
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
  renderParentPlaceholder("読み込み中です...");
  renderChildPlaceholder("親一覧から1件選択してください。");
  summaryText.textContent = "0 件";
  selectionSummary.textContent = "選択 0 件";
  contextSummary.textContent = "親一覧";
  detailPre.textContent = "読み込み中です...";
  btnExecute.disabled = true;
}

function updateSelectionSummary() {
  selectionSummary.textContent = `選択 ${checkedChildIds.size} 件`;
  btnExecute.disabled = checkedChildIds.size === 0;
}

function renderParentTable(rows) {
  parentTableHead.innerHTML = `
    <tr>
      <th>job_id</th>
      <th>source_type</th>
      <th>status</th>
      <th>selected</th>
      <th>qa</th>
      <th>plain</th>
      <th>requested_at</th>
    </tr>
  `;

  if (!rows.length) {
    renderParentPlaceholder("job がありません。");
    return;
  }

  parentTableBody.innerHTML = rows.map((row) => `
    <tr class="clickable-row ${row.job_id === selectedParentJobId ? "selected-row" : ""}" data-job-id="${escapeHtml(row.job_id)}">
      <td>${escapeHtml(row.job_id)}</td>
      <td>${escapeHtml(row.source_type)}</td>
      <td><span class="${getStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.selected_count ?? 0)}</td>
      <td>${escapeHtml(row.qa_count ?? 0)}</td>
      <td>${escapeHtml(row.plain_count ?? 0)}</td>
      <td>${escapeHtml(row.requested_at ?? "")}</td>
    </tr>
  `).join("");

  parentTableBody.querySelectorAll("tr[data-job-id]").forEach((tr) => {
    tr.addEventListener("click", async () => {
      selectedParentJobId = tr.dataset.jobId || "";
      selectedChildJobItemId = "";
      checkedChildIds = new Set();
      renderParentTable(parentRows);
      await loadChildRows(selectedParentJobId);
    });
  });
}

function renderChildTable(rows) {
  childTableHead.innerHTML = `
    <tr>
      <th class="checkbox-cell"></th>
      <th>job_item_id</th>
      <th>親ラベル</th>
      <th>status</th>
      <th>件数</th>
      <th>finished_at</th>
    </tr>
  `;

  if (!rows.length) {
    renderChildPlaceholder("子データがありません。");
    return;
  }

  childTableBody.innerHTML = rows.map((row) => `
    <tr class="clickable-row ${row.job_item_id === selectedChildJobItemId ? "selected-row" : ""}" data-job-item-id="${escapeHtml(row.job_item_id)}">
      <td class="checkbox-cell">
        <input type="checkbox" class="child-checkbox" data-job-item-id="${escapeHtml(row.job_item_id)}" ${checkedChildIds.has(row.job_item_id) ? "checked" : ""}>
      </td>
      <td>${escapeHtml(row.job_item_id)}</td>
      <td>${escapeHtml(row.parent_label ?? "")}</td>
      <td><span class="${getStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.knowledge_count ?? 0)}</td>
      <td>${escapeHtml(row.finished_at ?? "")}</td>
    </tr>
  `).join("");

  childTableBody.querySelectorAll(".child-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = checkbox.dataset.jobItemId || "";
      if (!id) return;

      if (checkbox.checked) {
        checkedChildIds.add(id);
      } else {
        checkedChildIds.delete(id);
      }
      updateSelectionSummary();
    });
  });

  childTableBody.querySelectorAll("tr[data-job-item-id]").forEach((tr) => {
    tr.addEventListener("click", async () => {
      selectedChildJobItemId = tr.dataset.jobItemId || "";
      renderChildTable(childRows);
      await loadDetail(selectedChildJobItemId);
    });
  });

  updateSelectionSummary();
}

async function loadParentRows() {
  resetScreen();

  const data = await apiGet("/knowledge/jobs");
  parentRows = Array.isArray(data?.jobs) ? data.jobs : [];

  summaryText.textContent = `${parentRows.length} 件`;
  contextSummary.textContent = "親一覧: knowledge_jobs";
  renderParentTable(parentRows);

  if (!parentRows.length) {
    detailPre.textContent = "job がありません。";
  } else {
    detailPre.textContent = "親一覧から1件選択してください。";
  }
}

async function loadChildRows(jobId) {
  renderChildPlaceholder("読み込み中です...");
  detailPre.textContent = "子一覧を読み込み中です...";
  contextSummary.textContent = `子一覧: ${jobId}`;

  const data = await apiGet(`/knowledge/jobs/${encodeURIComponent(jobId)}/items`);
  childRows = Array.isArray(data?.items) ? data.items : [];

  renderChildTable(childRows);

  if (!childRows.length) {
    detailPre.textContent = "子データがありません。";
  } else {
    detailPre.textContent = "子一覧から1件選択してください。";
  }
}

function buildDetailText(data) {
  const lines = [];

  lines.push(`job_item_id: ${data?.job_item?.job_item_id ?? ""}`);
  lines.push(`parent_label: ${data?.job_item?.parent_label ?? ""}`);
  lines.push(`status: ${data?.job_item?.status ?? ""}`);
  lines.push(`knowledge_count: ${data?.job_item?.knowledge_count ?? 0}`);
  lines.push("");

  const contents = Array.isArray(data?.contents) ? data.contents : [];
  if (contents.length) {
    lines.push("=== contents ===");
    contents.forEach((item, index) => {
      lines.push(`--- content ${index + 1} ---`);
      lines.push(item?.content_text ?? "");
      lines.push("");
    });
  }

  const knowledgeItems = Array.isArray(data?.knowledge_items) ? data.knowledge_items : [];
  if (knowledgeItems.length) {
    lines.push("=== knowledge_items ===");
    knowledgeItems.forEach((item, index) => {
      lines.push(`--- item ${index + 1} ---`);
      lines.push(`knowledge_type: ${item?.knowledge_type ?? ""}`);
      if (item?.question) lines.push(`question: ${item.question}`);
      if (item?.answer) lines.push(`answer: ${item.answer}`);
      if (item?.content) lines.push(`content: ${item.content}`);
      lines.push("");
    });
  }

  if (!contents.length && !knowledgeItems.length) {
    lines.push(JSON.stringify(data, null, 2));
  }

  return lines.join("\n");
}

async function loadDetail(jobItemId) {
  detailPre.textContent = "詳細を読み込み中です...";

  const data = await apiGet(`/knowledge/job_items/${encodeURIComponent(jobItemId)}`);
  detailPre.textContent = buildDetailText(data);
}

async function executeKnowledgeJob() {
  const ids = Array.from(checkedChildIds);
  if (!ids.length) {
    alert("対象を選択してください");
    return;
  }

  detailPre.textContent = "ここでは job_item 単位の再処理API をつなぐ想定です。";
  alert("この画面ではまず一覧と詳細確認まで作成しています。実行API接続は次段階です。");
}

function bindEvents() {
  btnReload?.addEventListener("click", async () => {
    await loadParentRows();
  });

  btnExecute?.addEventListener("click", async () => {
    await executeKnowledgeJob();
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
  bindEvents();
  await loadParentRows();
});
