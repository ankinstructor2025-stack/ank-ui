console.log("knowledge_view.js loaded");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";
const PAGE_SIZE = 10;

const btnReload = document.getElementById("btnReload");

const tabQa = document.getElementById("tabQa");
const tabPlain = document.getElementById("tabPlain");

const listContainer = document.getElementById("listContainer");
const detailContainer = document.getElementById("detailContainer");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

let currentSourceKey = "";
let currentSourceType = "";
let currentDbName = "";
let currentTab = "qa";
let currentPage = 1;
let currentTotal = 0;
let currentRows = [];
let currentSelectedRow = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFirebaseAuth() {
  try {
    if (window.firebase && typeof window.firebase.auth === "function") {
      return window.firebase.auth();
    }
  } catch (_) {}
  return null;
}

async function getIdToken(forceRefresh = false) {
  const auth = getFirebaseAuth();

  if (auth && auth.currentUser) {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    if (token) {
      sessionStorage.setItem("idToken", token);
      return token;
    }
  }

  const cached = sessionStorage.getItem("idToken");
  if (cached) {
    return cached;
  }

  throw new Error("ログイン情報が見つかりません");
}

async function requireIdToken(forceRefresh = false) {
  const idToken = await getIdToken(forceRefresh);
  if (!idToken) {
    throw new Error("ログイン情報が見つかりません");
  }
  return idToken;
}

function buildApiUrl(path, query = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE}${normalizedPath}`);

  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  return url.toString();
}

async function readErrorDetail(res) {
  let detail = `APIエラー (HTTP ${res.status})`;

  try {
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.detail) {
        detail = data.detail;
      }
    } else {
      const text = await res.text();
      if (text) {
        detail = text;
      }
    }
  } catch (_) {}

  return detail;
}

async function fetchWithAuth(path, options = {}, query = {}, retry401 = true) {
  const url = buildApiUrl(path, query);
  const idToken = await requireIdToken(false);

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${idToken}`
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401 && retry401) {
    const refreshedToken = await requireIdToken(true);
    const retryHeaders = {
      ...(options.headers || {}),
      Authorization: `Bearer ${refreshedToken}`
    };

    return await fetch(url, {
      ...options,
      headers: retryHeaders
    });
  }

  return res;
}

async function apiGet(path, query = {}) {
  const res = await fetchWithAuth(
    path,
    { method: "GET" },
    query,
    true
  );

  if (!res.ok) {
    throw new Error(await readErrorDetail(res));
  }

  return await res.json();
}

function setActiveTab(tab) {
  currentTab = tab === "plain" ? "plain" : "qa";

  tabQa.classList.toggle("active", currentTab === "qa");
  tabPlain.classList.toggle("active", currentTab === "plain");

  currentPage = 1;
  currentSelectedRow = null;
}

function updateSummary() {
  summaryText.textContent = `${currentTotal} 件`;
  selectionSummary.textContent = currentSelectedRow
    ? `選択: ${currentSelectedRow.knowledge_id || "-"}`
    : "未選択";
  contextSummary.textContent = `DB: ${currentDbName || "-"} / ${currentTab.toUpperCase()}`;
}

function clearDetail(message = "一覧から1件選択してください。") {
  detailContainer.innerHTML = `
    <div class="kv-detail-empty">
      <div class="kv-detail-meta">DB: ${escapeHtml(currentDbName || "-")}</div>
      <pre class="kv-detail-pre">${escapeHtml(message)}</pre>
    </div>
  `;
}

function renderListPlaceholder(message) {
  listContainer.innerHTML = `
    <div class="kv-placeholder-box">
      ${escapeHtml(message)}
    </div>
  `;
}

function resetListState(message = "ナレッジDBを選択してください。") {
  currentTotal = 0;
  currentPage = 1;
  currentRows = [];
  currentSelectedRow = null;

  updateSummary();
  renderListPlaceholder(message);
  clearDetail(message);
}

function formatDateTime(value) {
  if (!value) return "";
  return String(value);
}

function buildQaCard(row, selected) {
  return `
    <button
      type="button"
      class="kv-item-card ${selected ? "is-selected" : ""}"
      data-knowledge-id="${escapeHtml(row.knowledge_id || "")}"
    >
      <div class="kv-item-top">
        <span class="kv-item-id">${escapeHtml(row.knowledge_id || "")}</span>
        <span class="kv-item-sort">sort: ${escapeHtml(row.sort_no ?? "")}</span>
      </div>

      <div class="kv-item-block">
        <div class="kv-item-label">質問</div>
        <div class="kv-item-text">${escapeHtml(row.question || "")}</div>
      </div>

      <div class="kv-item-block">
        <div class="kv-item-label">回答</div>
        <div class="kv-item-text">${escapeHtml(row.answer || "")}</div>
      </div>
    </button>
  `;
}

function buildPlainCard(row, selected) {
  return `
    <button
      type="button"
      class="kv-item-card ${selected ? "is-selected" : ""}"
      data-knowledge-id="${escapeHtml(row.knowledge_id || "")}"
    >
      <div class="kv-item-top">
        <span class="kv-item-id">${escapeHtml(row.knowledge_id || "")}</span>
        <span class="kv-item-sort">sort: ${escapeHtml(row.sort_no ?? "")}</span>
      </div>

      <div class="kv-item-block">
        <div class="kv-item-label">内容</div>
        <div class="kv-item-text">${escapeHtml(row.content || "")}</div>
      </div>

      <div class="kv-item-meta">
        ${escapeHtml(formatDateTime(row.updated_at || row.created_at || ""))}
      </div>
    </button>
  `;
}

function renderList(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  currentRows = safeRows;

  if (safeRows.length === 0) {
    renderListPlaceholder("データがありません。");
    return;
  }

  listContainer.innerHTML = `
    <div class="kv-item-list">
      ${safeRows.map((row) => {
        const selected =
          currentSelectedRow &&
          currentSelectedRow.knowledge_id === row.knowledge_id;

        return currentTab === "qa"
          ? buildQaCard(row, selected)
          : buildPlainCard(row, selected);
      }).join("")}
    </div>
  `;

  listContainer.querySelectorAll(".kv-item-card").forEach((button) => {
    button.addEventListener("click", () => {
      const knowledgeId = button.dataset.knowledgeId || "";
      const row = safeRows.find((item) => String(item.knowledge_id || "") === knowledgeId);
      if (!row) return;

      currentSelectedRow = row;
      updateSummary();
      renderList(currentRows);
      renderDetail(row);
    });
  });
}

function renderDetail(row) {
  if (!row) {
    clearDetail("一覧から1件選択してください。");
    return;
  }

  const knowledgeType = (row.knowledge_type || currentTab || "-").toUpperCase();

  let bodyHtml = "";

  if (currentTab === "qa") {
    bodyHtml = `
      <div class="kv-detail-section">
        <div class="kv-detail-label">質問</div>
        <pre class="kv-detail-pre">${escapeHtml(row.question || "")}</pre>
      </div>

      <div class="kv-detail-section">
        <div class="kv-detail-label">回答</div>
        <pre class="kv-detail-pre">${escapeHtml(row.answer || "")}</pre>
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="kv-detail-section">
        <div class="kv-detail-label">説明文</div>
        <pre class="kv-detail-pre">${escapeHtml(row.content || "")}</pre>
      </div>
    `;
  }

  detailContainer.innerHTML = `
    <div class="kv-detail-card">
      <div class="kv-detail-head">
        <div class="kv-detail-head-row">
          <span class="kv-detail-head-label">DB</span>
          <span class="kv-detail-head-value">${escapeHtml(currentDbName || "-")}</span>
        </div>
        <div class="kv-detail-head-row">
          <span class="kv-detail-head-label">種別</span>
          <span class="kv-detail-head-value">${escapeHtml(knowledgeType)}</span>
        </div>
        <div class="kv-detail-head-row">
          <span class="kv-detail-head-label">ID</span>
          <span class="kv-detail-head-value">${escapeHtml(row.knowledge_id || "-")}</span>
        </div>
      </div>

      ${bodyHtml}
    </div>
  `;
}

async function loadKnowledgeItems() {
  if (!currentSourceType) {
    resetListState("データ種別を選択してください。");
    return;
  }

  if (!currentDbName) {
    resetListState("ナレッジDBを選択してください。");
    return;
  }

  renderListPlaceholder("読み込み中です...");
  clearDetail("読み込み中です...");

  const data = await apiGet("/knowledge/items", {
    source_type: currentSourceType,
    db_name: currentDbName,
    knowledge_type: currentTab,
    page: currentPage,
    page_size: PAGE_SIZE
  });

  const rows = Array.isArray(data?.items) ? data.items : [];
  currentTotal = Number(data?.total || 0);

  if (rows.length > 0) {
    currentSelectedRow = rows[0];
    renderList(rows);
    renderDetail(rows[0]);
  } else {
    currentSelectedRow = null;
    renderList(rows);
    clearDetail("データがありません。");
  }

  updateSummary();
}

function bindEvents() {
  document.addEventListener("toolbar:source-change", (event) => {
    const detail = event.detail || {};

    currentSourceKey = detail.sourceKey || "";
    currentSourceType = detail.sourceType || "";
    currentDbName = "";
    currentPage = 1;
    currentSelectedRow = null;

    resetListState("ナレッジDBを選択してください。");
  });

  document.addEventListener("toolbar:db-change", async (event) => {
    try {
      const detail = event.detail || {};

      currentSourceKey = detail.sourceKey || currentSourceKey;
      currentSourceType = detail.sourceType || currentSourceType;
      currentDbName = detail.dbName || "";
      currentPage = 1;
      currentSelectedRow = null;

      if (currentDbName) {
        await loadKnowledgeItems();
      } else {
        resetListState("ナレッジDBを選択してください。");
      }
    } catch (e) {
      console.error(e);
      resetListState(e.message || "ナレッジ一覧読込に失敗しました。");
    }
  });

  tabQa.addEventListener("click", async () => {
    try {
      setActiveTab("qa");
      await loadKnowledgeItems();
    } catch (e) {
      console.error(e);
      resetListState(e.message || "QA読込に失敗しました。");
    }
  });

  tabPlain.addEventListener("click", async () => {
    try {
      setActiveTab("plain");
      await loadKnowledgeItems();
    } catch (e) {
      console.error(e);
      resetListState(e.message || "PLAIN読込に失敗しました。");
    }
  });

  if (btnReload) {
    btnReload.addEventListener("click", async () => {
      try {
        if (currentDbName) {
          await loadKnowledgeItems();
        } else if (currentSourceType) {
          resetListState("ナレッジDBを選択してください。");
        } else {
          resetListState("データ種別を選択してください。");
        }
      } catch (e) {
        console.error(e);
        resetListState(e.message || "再読込に失敗しました。");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  resetListState("データ種別を選択してください。");
});
