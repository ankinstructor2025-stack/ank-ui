console.log("knowledge_create.js loaded");

const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const contextSummary = document.getElementById("contextSummary");

const parentTableHead = document.getElementById("parentTableHead");
const parentTableBody = document.getElementById("parentTableBody");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let parentRows = [];

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

function resetScreen() {
  renderParentPlaceholder("親一覧を読み込み中です...");
  summaryText.textContent = "0 件";
  contextSummary.textContent = "親一覧";
  parentRows = [];
}

function getNextAction(status) {
  const s = String(status ?? "").toLowerCase();

  if (s === "new" || s === "ready") {
    return { label: "クレンジング", action: "cleanse" };
  }

  if (s === "cleansed" || s === "cleanse_done") {
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
  if (actionName === "cleanse") {
    return `/knowledge/refine/jobs/${jobId}/cleanse`;
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
    await loadParentRows();
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
    }
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

      return `
        <tr>
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

async function loadParentRows() {
  resetScreen();

  const data = await apiGet("/knowledge/refine/jobs");
  parentRows = Array.isArray(data.jobs) ? data.jobs : [];

  summaryText.textContent = `${parentRows.length} 件`;
  contextSummary.textContent = "親一覧: knowledge_jobs";

  renderParentTable(parentRows);
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
  }
});
