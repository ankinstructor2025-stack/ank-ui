console.log("knowledge_search.js loaded");

/* ==============================
   API設定
============================== */

const API_BASE =
  "https://ank-api-986862757498.asia-northeast1.run.app/v1";

/* ==============================
   DOM
============================== */

const sourceTypeSelect = document.getElementById("sourceTypeSelect");
const databaseSelect = document.getElementById("databaseSelect");
const queryText = document.getElementById("queryText");

const btnSearch = document.getElementById("btnSearch");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const sourceSummary = document.getElementById("sourceSummary");
const contextSummary = document.getElementById("contextSummary");

const resultQaSimilarity = document.getElementById("resultQaSimilarity");
const resultPlainFts = document.getElementById("resultPlainFts");
const resultHybrid = document.getElementById("resultHybrid");
const resultHybridAi = document.getElementById("resultHybridAi");
const resultAiAnswer = document.getElementById("resultAiAnswer");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

let currentSourceType = "";
let currentDatabase = "";
let currentTab = "qa";

/* ==============================
   検索結果保持
============================== */

let lastQaResult = null;
let lastPlainResult = null;
let lastHybridResult = null;
let lastHybridAiResult = null;
let lastAiAnswerResult = null;

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

function normalizeTabName(tabName) {
  const src = String(tabName || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");

  if (
    src === "qa" ||
    src === "qasimilarity" ||
    src === "qasimilar" ||
    src === "qaresult"
  ) {
    return "qa";
  }

  if (
    src === "plainfts" ||
    src === "plain" ||
    src === "fts" ||
    src === "plainsearch"
  ) {
    return "plain";
  }

  if (src === "hybrid") {
    return "hybrid";
  }

  if (
    src === "hybridai" ||
    src === "hybridwithai"
  ) {
    return "hybrid-ai";
  }

  if (
    src === "aianswer" ||
    src === "ai" ||
    src === "answer"
  ) {
    return "ai-answer";
  }

  return "qa";
}

function detectTabFromButton(btn) {
  if (btn?.dataset?.tab) {
    return normalizeTabName(btn.dataset.tab);
  }

  const text = (btn?.textContent || "").trim();

  if (text.includes("QA")) return "qa";
  if (text.includes("プレイン")) return "plain";
  if (text.includes("ハイブリッド+AI")) return "hybrid-ai";
  if (text.includes("ハイブリッド")) return "hybrid";
  if (text.includes("AI回答")) return "ai-answer";

  return "qa";
}

function detectTabFromPanel(panel) {
  const id = panel?.id || "";
  if (id) {
    return normalizeTabName(id.replace(/^panel-/, ""));
  }

  const dataTab = panel?.dataset?.tab || "";
  if (dataTab) {
    return normalizeTabName(dataTab);
  }

  return "";
}

function getResultBoxByTab(tabName) {
  const tab = normalizeTabName(tabName);

  if (tab === "qa") return resultQaSimilarity;
  if (tab === "plain") return resultPlainFts;
  if (tab === "hybrid") return resultHybrid;
  if (tab === "hybrid-ai") return resultHybridAi;
  if (tab === "ai-answer") return resultAiAnswer;

  return resultQaSimilarity;
}

function clearStoredResults() {
  lastQaResult = null;
  lastPlainResult = null;
  lastHybridResult = null;
  lastHybridAiResult = null;
  lastAiAnswerResult = null;
}

function setDatabaseDisabledState(disabled) {
  databaseSelect.disabled = !!disabled;
}

function resetDatabaseOptions(placeholder = "選択してください") {
  databaseSelect.innerHTML =
    `<option value="" selected disabled>${escapeHtml(placeholder)}</option>`;
  currentDatabase = "";
  contextSummary.textContent = "DB:-";
}

function renderAllEmpty(message) {
  renderEmpty(resultQaSimilarity, message);
  renderEmpty(resultPlainFts, message);
  renderEmpty(resultHybrid, message);
  renderEmpty(resultHybridAi, message);
  renderEmpty(resultAiAnswer, message);
}

/* ==============================
   DB一覧取得
============================== */

async function fetchDatabaseList(sourceType) {
  const idToken = getIdToken();

  const url = new URL(`${API_BASE}/knowledge/dbs`);
  if (sourceType) {
    url.searchParams.set("source_type", sourceType);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": idToken
        ? `Bearer ${idToken}`
        : ""
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.detail || "DB一覧の取得に失敗しました。");
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

  (list || []).forEach((item) => {
    const dbName = item.database_name || item.db_name || "";
    if (!dbName) return;

    html.push(
      `<option value="${escapeHtml(dbName)}">${escapeHtml(dbName)}</option>`
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

  const first = list[0] || {};
  const firstDb = first.database_name || first.db_name || "";

  if (!firstDb) {
    currentDatabase = "";
    contextSummary.textContent = "DB:-";
    return;
  }

  databaseSelect.value = firstDb;
  currentDatabase = firstDb;
  contextSummary.textContent = `DB:${firstDb}`;
}

async function reloadDatabaseListBySourceType() {
  clearStoredResults();
  resetDatabaseOptions("読込中です...");
  setDatabaseDisabledState(true);

  summaryText.textContent = "件数:0件";
  selectionSummary.textContent = "入力:未実行";
  sourceSummary.textContent = currentSourceType || "-";

  if (!currentSourceType) {
    resetDatabaseOptions("データ種別を選択してください");
    renderAllEmpty("データ種別を選択してください。");
    return;
  }

  const dbList = await fetchDatabaseList(currentSourceType);

  renderDatabaseOptions(dbList);
  setDatabaseDisabledState(false);
  applyInitialDatabase(dbList);

  summaryText.textContent = "件数:0件";
  selectionSummary.textContent = "入力:未実行";
  sourceSummary.textContent = currentSourceType || "-";

  if (!dbList.length) {
    contextSummary.textContent = "DB:-";
    renderAllEmpty("該当するデータベースがありません。");
    return;
  }

  renderAllEmpty("検索文字列を入力してください。");
}

/* ==============================
   表示
============================== */

function renderEmpty(box, message) {
  if (!box) return;
  box.innerHTML = `<div class="result-empty">${escapeHtml(message)}</div>`;
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
  if (!box) return;

  if (!items || !items.length) {
    renderEmpty(box, emptyMessage);
    return;
  }

  box.innerHTML = items.map(buildCardHtml).join("");
}

/* ==============================
   タブ切替
============================== */

function setActiveTab(tabName) {
  currentTab = normalizeTabName(tabName);

  tabButtons.forEach((btn) => {
    const btnTab = detectTabFromButton(btn);
    btn.classList.toggle("active", btnTab === currentTab);
  });

  if (tabPanels.length > 0) {
    tabPanels.forEach((panel) => {
      const panelTab = detectTabFromPanel(panel);
      panel.classList.toggle("active", panelTab === currentTab);
    });
  }

  renderCurrentTab();
}

function bindTabEvents() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTab(detectTabFromButton(btn));
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

async function searchByMode(dbName, lines, mode) {
  const query = lines.join("\n");
  const idToken = getIdToken();

  const response = await fetch(
    `${API_BASE}/knowledge/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": idToken ? `Bearer ${idToken}` : ""
      },
      body: JSON.stringify({
        db_name: dbName,
        query: query,
        mode: mode
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
    throw new Error(data.detail || "検索に失敗しました。");
  }

  return data;
}

/* ==============================
   カード変換
============================== */

function buildPlainCards(items) {
  return (items || []).map((row) => {
    const subParts = [];

    if (row.source_type) subParts.push(row.source_type);
    if (row.source_label) subParts.push(row.source_label);
    if (row.score !== undefined) subParts.push(`bm25: ${row.score}`);

    const body = (row.content_preview || "").trim();
    const rawTitle = (row.title || "").trim();

    return {
      title: rawTitle && rawTitle !== body ? rawTitle : "",
      sub: subParts.join(" / "),
      body: body
    };
  });
}

function buildQaCards(items) {
  return (items || []).map((row) => {
    const subParts = [];

    if (row.source_type) subParts.push(row.source_type);
    if (row.source_label) subParts.push(row.source_label);
    if (row.score !== undefined) {
      subParts.push(`similarity: ${Number(row.score).toFixed(4)}`);
    }

    const question = (row.question || "").trim();
    const answer = (row.answer || row.content_preview || "").trim();

    return {
      title: question || "質問なし",
      sub: subParts.join(" / "),
      body: answer || "回答なし"
    };
  });
}

function buildHybridCards(qaItems, plainItems) {
  const cards = [];

  if (!qaItems || qaItems.length === 0) {
    cards.push({
      title: "QA類似結果なし",
      sub: "QA類似",
      body: "QA類似の結果はありません。"
    });
  } else {
    qaItems.forEach((row) => {
      const subParts = ["QA類似"];

      if (row.source_type) subParts.push(row.source_type);
      if (row.source_label) subParts.push(row.source_label);
      if (row.score !== undefined) {
        subParts.push(`similarity: ${Number(row.score).toFixed(4)}`);
      }

      cards.push({
        title: (row.question || "").trim() || "質問なし",
        sub: subParts.join(" / "),
        body: (row.answer || row.content_preview || "").trim() || "回答なし"
      });
    });
  }

  if (!plainItems || plainItems.length === 0) {
    cards.push({
      title: "FTS結果なし",
      sub: "FTS",
      body: "プレインFTSの結果はありません。"
    });
  } else {
    plainItems.forEach((row) => {
      const subParts = ["FTS"];

      if (row.source_type) subParts.push(row.source_type);
      if (row.source_label) subParts.push(row.source_label);
      if (row.score !== undefined) subParts.push(`bm25: ${row.score}`);

      const body = (row.content_preview || "").trim();
      const rawTitle = (row.title || "").trim();

      cards.push({
        title: rawTitle && rawTitle !== body ? rawTitle : "",
        sub: subParts.join(" / "),
        body: body
      });
    });
  }

  return cards;
}

function buildAiAnswerCards(items) {
  return (items || []).map((row) => {
    const subParts = [];

    if (row.source_type) subParts.push(row.source_type);
    if (row.source_label) subParts.push(row.source_label);

    const body = (row.answer || row.content_preview || row.content || "").trim();

    return {
      title: (row.title || "AI回答").trim(),
      sub: subParts.join(" / "),
      body: body || "回答なし"
    };
  });
}

/* ==============================
   結果保持から描画
============================== */

function renderQaResult() {
  renderCards(
    resultQaSimilarity,
    buildQaCards(lastQaResult?.items || []),
    "QA類似の結果はありません。"
  );
}

function renderPlainResult() {
  renderCards(
    resultPlainFts,
    buildPlainCards(lastPlainResult?.items || []),
    "プレインFTSの結果はありません。"
  );
}

function renderHybridResult() {
  renderCards(
    resultHybrid,
    buildHybridCards(
      lastHybridResult?.qa_items || [],
      lastHybridResult?.plain_items || []
    ),
    "ハイブリッドの結果はありません。"
  );
}

function renderHybridAiResult() {
  renderCards(
    resultHybridAi,
    buildAiAnswerCards(lastHybridAiResult?.items || []),
    "ハイブリッド+AI整理の結果はありません。"
  );
}

function renderAiAnswerResult() {
  renderCards(
    resultAiAnswer,
    buildAiAnswerCards(lastAiAnswerResult?.items || []),
    "AI回答はありません。"
  );
}

function renderCurrentTab() {
  const tab = normalizeTabName(currentTab);

  if (tab === "qa") {
    renderQaResult();
    return;
  }

  if (tab === "plain") {
    renderPlainResult();
    return;
  }

  if (tab === "hybrid") {
    renderHybridResult();
    return;
  }

  if (tab === "hybrid-ai") {
    renderHybridAiResult();
    return;
  }

  if (tab === "ai-answer") {
    renderAiAnswerResult();
    return;
  }

  renderQaResult();
}

/* ==============================
   検索実行
============================== */

async function executeSearch() {
  if (!currentSourceType) {
    alert("データ種別を選択してください");
    return;
  }

  if (!currentDatabase) {
    alert("データベースを選択してください");
    return;
  }

  const lines = getSearchLines();

  if (!lines.length) {
    alert("検索文字列を入力してください");
    return;
  }

  selectionSummary.textContent = `入力:検索語 ${lines.length} 行`;
  sourceSummary.textContent = currentSourceType || "-";
  contextSummary.textContent = `DB:${currentDatabase}`;
  summaryText.textContent = "件数:検索中";

  renderAllEmpty("検索中...");

  try {
    const [
      qaResult,
      plainResult,
      hybridResult,
      hybridAiResult,
      aiAnswerResult
    ] = await Promise.all([
      searchByMode(currentDatabase, lines, "qa"),
      searchByMode(currentDatabase, lines, "plain_fts"),
      searchByMode(currentDatabase, lines, "hybrid"),
      searchByMode(currentDatabase, lines, "hybrid_ai"),
      searchByMode(currentDatabase, lines, "ai_answer")
    ]);

    lastQaResult = qaResult;
    lastPlainResult = plainResult;
    lastHybridResult = hybridResult;
    lastHybridAiResult = hybridAiResult;
    lastAiAnswerResult = aiAnswerResult;

    const qaCount = qaResult?.count || 0;
    const plainCount = plainResult?.count || 0;
    const hybridCount = hybridResult?.count || 0;

    summaryText.textContent =
      `QA:${qaCount}件 / FTS:${plainCount}件 / Hybrid:${hybridCount}件`;

    renderQaResult();
    renderPlainResult();
    renderHybridResult();
    renderHybridAiResult();
    renderAiAnswerResult();
    renderCurrentTab();

  } catch (err) {
    console.error("search error", err);
    summaryText.textContent = "件数:0件";

    renderAllEmpty(err.message || "検索に失敗しました。");
  }
}

/* ==============================
   イベント
============================== */

function bindEvents() {
  sourceTypeSelect.addEventListener("change", async () => {
    currentSourceType = sourceTypeSelect.value || "";
    currentDatabase = "";

    try {
      await reloadDatabaseListBySourceType();
    } catch (err) {
      console.error("db list load error", err);

      resetDatabaseOptions("取得失敗");
      setDatabaseDisabledState(true);

      summaryText.textContent = "件数:0件";
      selectionSummary.textContent = "入力:未実行";
      sourceSummary.textContent = currentSourceType || "-";
      contextSummary.textContent = "DB:-";

      renderAllEmpty(err.message || "DB一覧の取得に失敗しました。");
    }
  });

  databaseSelect.addEventListener("change", () => {
    currentDatabase = databaseSelect.value || "";
    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";
    sourceSummary.textContent = currentSourceType || "-";
    contextSummary.textContent =
      currentDatabase ? `DB:${currentDatabase}` : "DB:-";

    clearStoredResults();
    renderAllEmpty(currentDatabase ? "検索文字列を入力してください。" : "データベースを選択してください。");
  });

  btnSearch.addEventListener("click", executeSearch);

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

  resetDatabaseOptions("データ種別を選択してください");
  setDatabaseDisabledState(true);

  summaryText.textContent = "件数:0件";
  selectionSummary.textContent = "入力:未実行";
  sourceSummary.textContent = "-";
  contextSummary.textContent = "DB:-";

  renderAllEmpty("データ種別を選択してください。");
  setActiveTab("qa");
});
