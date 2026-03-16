console.log("knowledge_create.js loaded");

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
    throw new Error("ログイン情報がありません。再ログインしてください。");
  }
  return idToken;
}

async function apiGet(path) {
  const idToken = requireIdToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) {
        message = data.detail;
      }
    } catch (_) {}
    throw new Error(message);
  }

  return await res.json();
}

async function apiPost(path) {
  const idToken = requireIdToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) {
        message = data.detail;
      }
    } catch (_) {}
    throw new Error(message);
  }

  return await res.json();
}

function renderParentPlaceholder(message) {
  parentTableHead.innerHTML = `<tr><th>message</th></tr>`;
  parentTableBody.innerHTML = `
    <tr>
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderChildPlaceholder(message) {
  childTableHead.innerHTML = `<tr><th>message</th></tr>`;
  childTableBody.innerHTML = `
    <tr>
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function clearChildAndDetailForParent() {
  childRows = [];
  selectedChildJobItemId = "";
  selectionSummary.textContent = "子 0 件";
  renderChildPlaceholder("親を選択してください。");
  detailPre.textContent = "親一覧から1件選択してください";
}

function resetScreen() {
  renderParentPlaceholder("親一覧を読み込み中です...");
  renderChildPlaceholder("親を選択してください。");

  summaryText.textContent = "0 件";
  selectionSummary.textContent = "子 0 件";
  contextSummary.textContent = "親一覧";

  detailPre.textContent = "親一覧を読み込み中です...";

  parentRows = [];
  childRows = [];
  selectedParentJobId = "";
  selectedChildJobItemId = "";
}

function getNextAction(status) {
  const s = String(status ?? "").toLowerCase();

  if (s === "new" || s === "ready") {
    return { label: "正規化", action: "normalize" };
  }

  if (s === "normalized" || s === "normalize_done") {
    return { label: "ベクトル化", action: "vectorize" };
  }

  if (s === "vectorized" || s === "vectorize_done") {
    return { label: "重複削除", action: "deduplicate" };
  }

  if (s === "deduplicated" || s === "deduplicate_done") {
    return { label: "ナレッジDB作成", action: "buildKnowledgeDb" };
  }

  return null;
}

function getActionPath(jobId, actionName) {
  if (actionName === "normalize") {
    return `/knowledge/refine/jobs/${jobId}/normalize`;
  }

  if (actionName === "vectorize") {
    return `/knowledge/refine/jobs/${jobId}/vectorize`;
  }

  if (actionName === "deduplicate") {
    return `/knowledge/refine/jobs/${jobId}/deduplicate`;
  }

  if (actionName === "buildKnowledgeDb") {
    return `/knowledge/refine/jobs/${jobId}/build-knowledge-db`;
  }

  throw new Error(`未対応の処理です: ${actionName}`);
}

async function executeParentAction(jobId, actionName, buttonEl) {
  const path = getActionPath(jobId, actionName);

  const originalText = buttonEl ? buttonEl.textContent : "";
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "処理中...";
  }

  try {
    await apiPost(path);
    await reloadAfterAction(jobId);
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
    }
  }
}

async function reloadAfterAction(jobId) {
  await loadParentRows(jobId);

  if (jobId) {
    await loadChildRows(jobId);
    loadDetailFromParent(jobId);
  }
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
    renderParentPlaceholder("job がありません");
    return;
  }

  parentTableBody.innerHTML = rows
    .map((row) => {
      const action = getNextAction(row.status);

      const actionButton = action
        ? `<button
             type="button"
             class="btn btn-primary parent-action-btn"
             data-job-id="${escapeHtml(row.job_id)}"
             data-action="${escapeHtml(action.action)}"
           >${escapeHtml(action.label)}</button>`
        : "-";

      const rowClass =
        row.job_id === selectedParentJobId
          ? "clickable-row selected-row"
          : "clickable-row";

      return `
        <tr class="${rowClass}" data-job-id="${escapeHtml(row.job_id)}">
          <td>${escapeHtml(row.source_type)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.selected_count)}</td>
          <td>${escapeHtml(row.qa_count)}</td>
          <td>${escapeHtml(row.plain_count)}</td>
          <td>${actionButton}</td>
        </tr>
      `;
    })
    .join("");

  parentTableBody.querySelectorAll("tr[data-job-id]").forEach((tr) => {
    tr.addEventListener("click", async () => {
      selectedParentJobId = tr.dataset.jobId || "";
      selectedChildJobItemId = "";

      renderParentTable(parentRows);
      await loadChildRows(selectedParentJobId);
      loadDetailFromParent(selectedParentJobId);
    });
  });

  parentTableBody.querySelectorAll(".parent-action-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const jobId = btn.dataset.jobId || "";
      const actionName = btn.dataset.action || "";

      try {
        await executeParentAction(jobId, actionName, btn);
      } catch (err) {
        console.error(err);
        alert(err.message || "処理に失敗しました");
      }
    });
  });
}

function renderChildTable(rows) {
  childTableHead.innerHTML = `
    <tr>
      <th>status</th>
      <th>title</th>
      <th>source_item_id</th>
    </tr>
  `;

  if (!rows.length) {
    renderChildPlaceholder("子データがありません");
    return;
  }

  childTableBody.innerHTML = rows
    .map((row) => {
      const rowClass =
        row.job_item_id === selectedChildJobItemId
          ? "clickable-row selected-row"
          : "clickable-row";

      return `
        <tr class="${rowClass}" data-job-item-id="${escapeHtml(row.job_item_id)}">
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.title)}</td>
          <td>${escapeHtml(row.source_item_id)}</td>
        </tr>
      `;
    })
    .join("");

  childTableBody.querySelectorAll("tr[data-job-item-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      selectedChildJobItemId = tr.dataset.jobItemId || "";
      renderChildTable(childRows);
      loadDetailFromChild(selectedChildJobItemId);
    });
  });
}

function buildParentDetailText(row) {
  return `
job_id: ${row.job_id}
source_type: ${row.source_type}
source_name: ${row.source_name}
request_type: ${row.request_type}
status: ${row.status}
selected_count: ${row.selected_count}
qa_count: ${row.qa_count}
plain_count: ${row.plain_count}
error_count: ${row.error_count}
requested_at: ${row.requested_at}
started_at: ${row.started_at}
finished_at: ${row.finished_at}
error_message: ${row.error_message}
`.trim();
}

function buildChildDetailText(row) {
  return `
job_item_id: ${row.job_item_id}
job_id: ${row.job_id}
source_item_id: ${row.source_item_id}
title: ${row.title}
status: ${row.status}
qa_count: ${row.qa_count}
plain_count: ${row.plain_count}
error_count: ${row.error_count}
error_message: ${row.error_message}
requested_at: ${row.requested_at}
started_at: ${row.started_at}
finished_at: ${row.finished_at}
`.trim();
}

function loadDetailFromParent(jobId) {
  const row = parentRows.find((x) => x.job_id === jobId);
  if (!row) return;
  detailPre.textContent = buildParentDetailText(row);
}

function loadDetailFromChild(jobItemId) {
  const row = childRows.find((x) => x.job_item_id === jobItemId);
  if (!row) return;
  detailPre.textContent = buildChildDetailText(row);
}

async function loadParentRows(preferredJobId = "", keepScreen = false) {
  if (!keepScreen) {
    resetScreen();
  }

  const data = await apiGet("/knowledge/refine/jobs");
  parentRows = Array.isArray(data.jobs) ? data.jobs : [];

  summaryText.textContent = `${parentRows.length} 件`;
  contextSummary.textContent = "親一覧: knowledge_jobs";

  if (preferredJobId && parentRows.some((x) => x.job_id === preferredJobId)) {
    selectedParentJobId = preferredJobId;
  } else if (selectedParentJobId && !parentRows.some((x) => x.job_id === selectedParentJobId)) {
    selectedParentJobId = "";
  }

  renderParentTable(parentRows);

  if (selectedParentJobId) {
    loadDetailFromParent(selectedParentJobId);
  } else {
    clearChildAndDetailForParent();
  }
}

async function loadChildRows(jobId) {
  renderChildPlaceholder("子一覧を読み込み中です...");

  const data = await apiGet(`/knowledge/refine/jobs/${jobId}/items`);
  childRows = Array.isArray(data.items) ? data.items : [];

  selectionSummary.textContent = `子 ${childRows.length} 件`;
  renderChildTable(childRows);
}

function bindEvents() {
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

  try {
    await loadParentRows();
  } catch (err) {
    console.error(err);
    renderParentPlaceholder(err.message || "親一覧の読み込みに失敗しました");
    renderChildPlaceholder("親を選択してください。");
    detailPre.textContent = err.message || "親一覧の読み込みに失敗しました";
  }
});
