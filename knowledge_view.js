console.log("knowledge_view.js loaded");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";
const PAGE_SIZE = 10;

const sourceSelect = document.getElementById("sourceSelect");
const dbSelect = document.getElementById("dbSelect");

const btnReload = document.getElementById("btnReload");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const tabQa = document.getElementById("tabQa");
const tabPlain = document.getElementById("tabPlain");

const listTableHead = document.getElementById("listTableHead");
const listTableBody = document.getElementById("listTableBody");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const btnPrevPage = document.getElementById("btnPrevPage");
const btnNextPage = document.getElementById("btnNextPage");
const pageInfo = document.getElementById("pageInfo");
const pagingSummary = document.getElementById("pagingSummary");

const detailDbName = document.getElementById("detailDbName");
const detailKnowledgeType = document.getElementById("detailKnowledgeType");
const detailPre = document.getElementById("detailPre");

let sourceList = [];
let sourceMap = {};

let currentSourceKey = "";
let currentSourceType = "";
let currentDbName = "";
let currentTab = "qa";
let currentPage = 1;
let currentTotal = 0;
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

function normalizeSourceType(key, type) {
  const keyText = String(key || "").trim();
  const typeText = String(type || "").trim();

  if (typeText === "upload") return "upload";
  if (typeText === "public_url") return "public_url";

  if (keyText === "api_kokkai") return "kokkai";
  if (keyText === "api_datago") return "opendata";

  if (keyText.startsWith("url_") || keyText.startsWith("url")) return "public_url";
  if (keyText === "file_upload") return "upload";

  return "";
}

function normalizeSourceMaster(list) {
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      const key = String(item?.key || "").trim();
      const label = String(item?.label || item?.name || key).trim();
      const group = String(item?.group || "その他").trim();
      const type = String(item?.type || "").trim();
      const sourceType = normalizeSourceType(key, type);

      return {
        key,
        label,
        group,
        type,
        sourceType
      };
    })
    .filter((item) => item.key);
}

function renderSourceOptions(list) {
  const groups = {};

  list.forEach((item) => {
    const groupName = item.group || "その他";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
  });

  const html = [`<option value="" selected>選択してください</option>`];

  Object.keys(groups).forEach((groupName) => {
    html.push(`<optgroup label="${escapeHtml(groupName)}">`);

    groups[groupName].forEach((item) => {
      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label || item.key)}</option>`
      );
    });

    html.push(`</optgroup>`);
  });

  sourceSelect.innerHTML = html.join("");
}

async function loadSourceMaster() {
  const res = await fetch("./source_master.json", {
    method: "GET",
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("source_master.json の取得に失敗しました");
  }

  const list = await res.json();
  sourceList = normalizeSourceMaster(Array.isArray(list) ? list : []);
  sourceMap = {};

  sourceList.forEach((item) => {
    sourceMap[item.key] = item;
  });

  renderSourceOptions(sourceList);
}

function setActiveTab(tab) {
  currentTab = tab === "plain" ? "plain" : "qa";

  tabQa.classList.toggle("active", currentTab === "qa");
  tabPlain.classList.toggle("active", currentTab === "plain");

  currentPage = 1;
  currentSelectedRow = null;
}

function clearDetail(message = "一覧から1件選択してください。") {
  detailDbName.textContent = currentDbName || "-";
  detailKnowledgeType.textContent = currentTab.toUpperCase();
  detailPre.textContent = message;
}

function renderListPlaceholder(message) {
  listTableHead.innerHTML = "";
  listTableBody.innerHTML = `
    <tr class="kv-placeholder-row">
      <td colspan="4">${escapeHtml(message)}</td>
    </tr>
  `;
}

function resetDbOptions(placeholder = "選択してください") {
  currentDbName = "";
  dbSelect.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
  dbSelect.disabled = true;
}

function resetListState(message = "ナレッジDBを選択してください。") {
  currentTotal = 0;
  currentPage = 1;
  currentSelectedRow = null;

  summaryText.textContent = "0 件";
  selectionSummary.textContent = "未選択";
  contextSummary.textContent = "ナレッジ一覧";
  pagingSummary.textContent = "0 / 0 ページ";
  pageInfo.textContent = "1 / 1";

  btnPrevPage.disabled = true;
  btnNextPage.disabled = true;

  renderListPlaceholder(message);
  clearDetail(message);
}

function formatDateTime(value) {
  if (!value) return "";
  return String(value);
}

function renderListTable(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (currentTab === "qa") {
    listTableHead.innerHTML = `
      <tr>
        <th class="kv-medium-cell">knowledge_id</th>
        <th>質問</th>
        <th>回答</th>
        <th class="kv-narrow-cell">sort_no</th>
      </tr>
    `;
  } else {
    listTableHead.innerHTML = `
      <tr>
        <th class="kv-medium-cell">knowledge_id</th>
        <th>内容</th>
        <th class="kv-narrow-cell">sort_no</th>
        <th class="kv-wide-cell">updated_at</th>
      </tr>
    `;
  }

  if (safeRows.length === 0) {
    listTableBody.innerHTML = `
      <tr class="kv-placeholder-row">
        <td colspan="4">データがありません。</td>
      </tr>
    `;
    return;
  }

  listTableBody.innerHTML = safeRows.map((row, idx) => {
    const selectedClass =
      currentSelectedRow && currentSelectedRow.knowledge_id === row.knowledge_id
        ? "kv-selected-row"
        : "";

    if (currentTab === "qa") {
      return `
        <tr class="kv-clickable-row ${selectedClass}" data-index="${idx}">
          <td>${escapeHtml(row.knowledge_id || "")}</td>
          <td title="${escapeHtml(row.question || "")}">${escapeHtml(row.question || "")}</td>
          <td title="${escapeHtml(row.answer || "")}">${escapeHtml(row.answer || "")}</td>
          <td>${escapeHtml(row.sort_no ?? "")}</td>
        </tr>
      `;
    }

    return `
      <tr class="kv-clickable-row ${selectedClass}" data-index="${idx}">
        <td>${escapeHtml(row.knowledge_id || "")}</td>
        <td title="${escapeHtml(row.content || "")}">${escapeHtml(row.content || "")}</td>
        <td>${escapeHtml(row.sort_no ?? "")}</td>
        <td>${escapeHtml(formatDateTime(row.updated_at || row.created_at || ""))}</td>
      </tr>
    `;
  }).join("");

  listTableBody.querySelectorAll("tr.kv-clickable-row").forEach((tr) => {
    tr.addEventListener("click", () => {
      const index = Number(tr.dataset.index);
      const row = safeRows[index];
      if (!row) return;

      currentSelectedRow = row;
      renderListTable(safeRows);
      renderDetail(row);
    });
  });
}

function renderDetail(row) {
  if (!row) {
    clearDetail("一覧から1件選択してください。");
    return;
  }

  detailDbName.textContent = currentDbName || "-";
  detailKnowledgeType.textContent = (row.knowledge_type || currentTab || "-").toUpperCase();

  const lines = [];

  if (currentTab === "qa") {
    lines.push("[質問]");
    lines.push(row.question || "");
    lines.push("");
    lines.push("[回答]");
    lines.push(row.answer || "");
  } else {
    lines.push("[説明文]");
    lines.push(row.content || "");
  }

  detailPre.textContent = lines.join("\n");
}

function updatePaging(total, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / pageSize));

  currentTotal = Number(total) || 0;
  currentPage = page;

  summaryText.textContent = `${currentTotal} 件`;
  selectionSummary.textContent = currentSelectedRow
    ? `選択: ${currentSelectedRow.knowledge_id || "-"}`
    : "未選択";
  contextSummary.textContent = `DB: ${currentDbName || "-"} / ${currentTab.toUpperCase()}`;

  pagingSummary.textContent = `${page} / ${totalPages} ページ`;
  pageInfo.textContent = `${page} / ${totalPages}`;

  btnPrevPage.disabled = page <= 1;
  btnNextPage.disabled = page >= totalPages;
}

async function loadKnowledgeDbOptions() {
  resetDbOptions("読込中です...");
  resetListState("ナレッジDBを読込中です...");

  if (!currentSourceType) {
    resetDbOptions("データ種別を選択してください");
    resetListState("データ種別を選択してください。");
    return;
  }

  const data = await apiGet("/knowledge/dbs", {
    source_type: currentSourceType
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  const options = [`<option value="">選択してください</option>`];

  items.forEach((item) => {
    const dbName = item.database_name || item.db_name || "";
    if (!dbName) return;

    options.push(
      `<option value="${escapeHtml(dbName)}">${escapeHtml(dbName)}</option>`
    );
  });

  dbSelect.innerHTML = options.join("");
  dbSelect.disabled = false;

  if (items.length === 0) {
    resetListState("該当するナレッジDBがありません。");
    return;
  }

  resetListState("ナレッジDBを選択してください。");
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
  renderListTable(rows);
  updatePaging(
    data?.total || 0,
    Number(data?.page) || currentPage,
    Number(data?.page_size) || PAGE_SIZE
  );

  if (rows.length > 0) {
    currentSelectedRow = rows[0];
    renderListTable(rows);
    renderDetail(rows[0]);
  } else {
    currentSelectedRow = null;
    clearDetail("データがありません。");
  }
}

function bindEvents() {
  sourceSelect.addEventListener("change", async () => {
    try {
      currentSourceKey = sourceSelect.value || "";

      const source = sourceMap[currentSourceKey];
      currentSourceType = source?.sourceType || "";
      currentDbName = "";
      currentSelectedRow = null;
      currentPage = 1;

      await loadKnowledgeDbOptions();
    } catch (e) {
      console.error(e);
      resetDbOptions("取得失敗");
      resetListState(e.message || "ナレッジDB読込に失敗しました。");
    }
  });

  dbSelect.addEventListener("change", async () => {
    try {
      currentDbName = dbSelect.value || "";
      currentPage = 1;
      currentSelectedRow = null;
      await loadKnowledgeItems();
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
          await loadKnowledgeDbOptions();
        } else {
          resetListState("データ種別を選択してください。");
        }
      } catch (e) {
        console.error(e);
        resetListState(e.message || "再読込に失敗しました。");
      }
    });
  }

  btnPrevPage.addEventListener("click", async () => {
    if (currentPage <= 1) return;

    try {
      currentPage -= 1;
      currentSelectedRow = null;
      await loadKnowledgeItems();
    } catch (e) {
      console.error(e);
      currentPage += 1;
      resetListState(e.message || "前ページ読込に失敗しました。");
    }
  });

  btnNextPage.addEventListener("click", async () => {
    const totalPages = Math.max(1, Math.ceil((Number(currentTotal) || 0) / PAGE_SIZE));
    if (currentPage >= totalPages) return;

    try {
      currentPage += 1;
      currentSelectedRow = null;
      await loadKnowledgeItems();
    } catch (e) {
      console.error(e);
      currentPage -= 1;
      resetListState(e.message || "次ページ読込に失敗しました。");
    }
  });

  btnMenu.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    localStorage.removeItem("idToken");
    window.location.href = "./index.html";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  resetDbOptions("データ種別を選択してください");
  resetListState("データ種別を選択してください。");

  try {
    await loadSourceMaster();
  } catch (e) {
    console.error(e);
    resetListState(e.message || "source master の取得に失敗しました。");
  }
});
