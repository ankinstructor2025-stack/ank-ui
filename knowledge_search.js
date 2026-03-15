console.log("knowledge_search.js loaded");

/* ==============================
   API設定
============================== */

const API_BASE =
  "https://ank-api-986862757498.asia-northeast1.run.app/v1";

/* ==============================
   DOM
============================== */

const databaseSelect = document.getElementById("databaseSelect");
const queryText = document.getElementById("queryText");

const btnSearch = document.getElementById("btnSearch");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const resultQaSimilarity = document.getElementById("resultQaSimilarity");
const resultPlainFts = document.getElementById("resultPlainFts");
const resultHybrid = document.getElementById("resultHybrid");
const resultHybridAi = document.getElementById("resultHybridAi");
const resultAiAnswer = document.getElementById("resultAiAnswer");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

let currentDatabase = "";

/* ==============================
   Utils
============================== */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getIdToken() {
  return (
    sessionStorage.getItem("idToken") ||
    localStorage.getItem("idToken") ||
    ""
  );
}

/* ==============================
   DB一覧取得
============================== */

async function fetchDatabaseList() {
  const idToken = getIdToken();

  const response = await fetch(
    `${API_BASE}/knowledge/dbs`,
    {
      method: "GET",
      headers: {
        "Authorization": idToken
          ? `Bearer ${idToken}`
          : ""
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.detail || "DB一覧の取得に失敗しました。"
    );
  }

  return data.items || [];
}

/* ==============================
   DB選択
============================== */

function renderDatabaseOptions(list) {
  const html = [
    `<option value="" selected disabled>選択してください</option>`
  ];

  list.forEach((item) => {
    html.push(
      `<option value="${escapeHtml(item.db_name)}">${escapeHtml(item.db_name)}</option>`
    );
  });

  databaseSelect.innerHTML = html.join("");
}

function applyInitialDatabase(list) {
  if (!list || !list.length) {
    currentDatabase = "";
    contextSummary.textContent = "DB:-";
    return;
  }

  const firstDb = list[0].db_name || "";

  if (!firstDb) {
    currentDatabase = "";
    contextSummary.textContent = "DB:-";
    return;
  }

  databaseSelect.value = firstDb;
  currentDatabase = firstDb;
  contextSummary.textContent = `DB:${firstDb}`;
}

/* ==============================
   表示
============================== */

function renderEmpty(box, message) {
  box.innerHTML =
    `<div class="result-empty">${escapeHtml(message)}</div>`;
}

function buildCardHtml(item) {
  return `
<div class="result-card">
  ${item.title ? `<div class="result-card-title">${escapeHtml(item.title)}</div>` : ""}
  <div class="result-card-sub">${escapeHtml(item.sub || "")}</div>
  <div class="result-card-body">${escapeHtml(item.body || "")}</div>
</div>
`;
}

function renderCards(box, items, emptyMessage) {
  if (!items || !items.length) {
    renderEmpty(box, emptyMessage);
    return;
  }

  box.innerHTML = items.map(buildCardHtml).join("");
}

/* ==============================
   Tab
============================== */

function setActiveTab(tabName) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.tab === tabName
    );
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle(
      "active",
      panel.id === `panel-${tabName}`
    );
  });
}

function bindTabEvents() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTab(btn.dataset.tab);
    });
  });
}

/* ==============================
   検索
============================== */

function getSearchLines() {
  return (queryText.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
}

/* ==============================
   プレインFTS検索
============================== */

async function searchPlainFts(dbName, lines) {
  const query = lines.join("\n");
  const idToken = getIdToken();

  const response = await fetch(
    `${API_BASE}/knowledge/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": idToken
          ? `Bearer ${idToken}`
          : ""
      },
      body: JSON.stringify({
        db_name: dbName,
        query: query,
        mode: "plain_fts"
      })
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.detail || "プレインFTS検索に失敗しました。"
    );
  }

  return data;
}

/* ==============================
   カード変換
============================== */

function buildPlainCards(items) {
  return (items || []).map((row) => {
    const subParts = [];

    if (row.source_type) {
      subParts.push(row.source_type);
    }

    if (row.source_label) {
      subParts.push(row.source_label);
    }

    if (row.score !== undefined) {
      subParts.push(`bm25: ${row.score}`);
    }

    const body = (row.content_preview || "").trim();
    const rawTitle = (row.title || "").trim();

    return {
      title: rawTitle && rawTitle !== body ? rawTitle : "",
      sub: subParts.join(" / "),
      body: body
    };
  });
}

/* ==============================
   検索実行
============================== */

async function executeSearch() {
  if (!currentDatabase) {
    alert("データベースを選択してください");
    return;
  }

  const lines = getSearchLines();

  if (!lines.length) {
    alert("検索文字列を入力してください");
    return;
  }

  selectionSummary.textContent =
    `入力:検索語 ${lines.length} 行`;

  contextSummary.textContent =
    `DB:${currentDatabase}`;

  summaryText.textContent = "件数:検索中";
  renderEmpty(resultPlainFts, "検索中...");

  try {
    const plainResult =
      await searchPlainFts(currentDatabase, lines);

    const plainCards =
      buildPlainCards(plainResult.items || []);

    renderCards(
      resultPlainFts,
      plainCards,
      "プレインFTSの結果はありません。"
    );

    summaryText.textContent =
      `件数:${plainResult.count || 0}件`;

  } catch (err) {
    console.error("search error", err);

    summaryText.textContent = "件数:0件";

    renderEmpty(
      resultPlainFts,
      err.message || "検索に失敗しました。"
    );
  }
}

/* ==============================
   イベント
============================== */

function bindEvents() {
  databaseSelect.addEventListener("change", () => {
    currentDatabase = databaseSelect.value || "";

    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";
    contextSummary.textContent =
      currentDatabase ? `DB:${currentDatabase}` : "DB:-";
  });

  btnSearch.addEventListener(
    "click",
    executeSearch
  );

  btnMenu.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    localStorage.removeItem("idToken");
    window.location.href = "./index.html";
  });

  bindTabEvents();
}

/* ==============================
   Init
============================== */

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();

  try {
    const dbList = await fetchDatabaseList();

    renderDatabaseOptions(dbList);
    applyInitialDatabase(dbList);

    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";

    renderEmpty(
      resultPlainFts,
      dbList.length
        ? "検索文字列を入力してください。"
        : "データベースがありません。"
    );

  } catch (err) {
    console.error("db list load error", err);

    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";
    contextSummary.textContent = "DB:-";

    renderEmpty(
      resultPlainFts,
      "DB一覧の取得に失敗しました。"
    );
  }
});
