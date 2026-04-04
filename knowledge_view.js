console.log("knowledge_view.js loaded");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";
const PAGE_SIZE = 10;

const btnReload = document.getElementById("btnReload");
const btnPrevPage = document.getElementById("btnPrevPage");
const btnNextPage = document.getElementById("btnNextPage");

const tabQa = document.getElementById("tabQa");
const tabPlain = document.getElementById("tabPlain");

const listContainer = document.getElementById("listContainer");
const paginationInfo = document.getElementById("paginationInfo");

let currentSourceKey = "";
let currentSourceType = "";
let currentDbName = "";
let currentTab = "qa";
let currentPage = 1;
let currentTotal = 0;
let currentRows = [];

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

function getTotalPages() {
  return Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));
}

function setActiveTab(tab) {
  currentTab = tab === "plain" ? "plain" : "qa";

  if (tabQa) tabQa.classList.toggle("active", currentTab === "qa");
  if (tabPlain) tabPlain.classList.toggle("active", currentTab === "plain");

  currentPage = 1;
}

function updateSummary() {
  const totalPages = getTotalPages();

  if (paginationInfo) {
    paginationInfo.textContent = `${currentPage} / ${totalPages}`;
  }

  if (btnPrevPage) {
    btnPrevPage.disabled = currentPage <= 1;
  }

  if (btnNextPage) {
    btnNextPage.disabled = currentPage >= totalPages;
  }
}

function renderListPlaceholder(message) {
  if (!listContainer) return;

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

  updateSummary();
  renderListPlaceholder(message);
}

function buildQaCard(row) {
  return `
    <div class="kv-item-card">
      <div class="kv-line">
        <span class="kv-line-label">質問：</span>
        <span class="kv-line-text">${escapeHtml(row.question || "")}</span>
      </div>

      <div class="kv-line">
        <span class="kv-line-label">回答：</span>
        <span class="kv-line-text">${escapeHtml(row.answer || "")}</span>
      </div>
    </div>
  `;
}

function buildPlainCard(row) {
  return `
    <div class="kv-item-card">
      <div class="kv-line">
        <span class="kv-line-label">内容：</span>
        <span class="kv-line-text">${escapeHtml(row.content || "")}</span>
      </div>
    </div>
  `;
}

function renderList(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  currentRows = safeRows;

  if (!listContainer) return;

  if (safeRows.length === 0) {
    renderListPlaceholder("データがありません。");
    return;
  }

  listContainer.innerHTML = `
    <div class="kv-item-list">
      ${safeRows.map((row) => {
        return currentTab === "qa"
          ? buildQaCard(row)
          : buildPlainCard(row);
      }).join("")}
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

  const data = await apiGet("/knowledge/items", {
    source_type: currentSourceType,
    db_name: currentDbName,
    knowledge_type: currentTab,
    page: currentPage,
    page_size: PAGE_SIZE
  });

  const rows = Array.isArray(data?.items) ? data.items : [];
  currentTotal = Number(data?.total || 0);

  const totalPages = getTotalPages();
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  renderList(rows);
  updateSummary();
}

function bindEvents() {
  document.addEventListener("toolbar:source-change", (event) => {
    const detail = event.detail || {};

    currentSourceKey = detail.sourceKey || "";
    currentSourceType = detail.sourceType || "";
    currentDbName = "";
    currentPage = 1;

    resetListState("ナレッジDBを選択してください。");
  });

  document.addEventListener("toolbar:db-change", async (event) => {
    try {
      const detail = event.detail || {};

      currentSourceKey = detail.sourceKey || currentSourceKey;
      currentSourceType = detail.sourceType || currentSourceType;
      currentDbName = detail.dbName || "";
      currentPage = 1;

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

  if (tabQa) {
    tabQa.addEventListener("click", async () => {
      try {
        setActiveTab("qa");
        await loadKnowledgeItems();
      } catch (e) {
        console.error(e);
        resetListState(e.message || "QA読込に失敗しました。");
      }
    });
  }

  if (tabPlain) {
    tabPlain.addEventListener("click", async () => {
      try {
        setActiveTab("plain");
        await loadKnowledgeItems();
      } catch (e) {
        console.error(e);
        resetListState(e.message || "PLAIN読込に失敗しました。");
      }
    });
  }

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

  if (btnPrevPage) {
    btnPrevPage.addEventListener("click", async () => {
      if (currentPage <= 1) return;

      try {
        currentPage -= 1;
        await loadKnowledgeItems();
      } catch (e) {
        console.error(e);
        currentPage += 1;
        resetListState(e.message || "前ページ読込に失敗しました。");
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener("click", async () => {
      if (currentPage >= getTotalPages()) return;

      try {
        currentPage += 1;
        await loadKnowledgeItems();
      } catch (e) {
        console.error(e);
        currentPage -= 1;
        resetListState(e.message || "次ページ読込に失敗しました。");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  resetListState("データ種別を選択してください。");
});
