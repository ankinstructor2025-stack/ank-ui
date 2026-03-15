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
let currentTab = "qa";

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

function getModeByTab(tabName) {
  const tab = normalizeTabName(tabName);

  if (tab === "qa") return "qa";
  if (tab === "plain") return "plain_fts";
  if (tab === "hybrid") return "hybrid";
  if (tab === "hybrid-ai") return "hybrid_ai";
  if (tab === "ai-answer") return "ai_answer";

  return "qa";
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

function getEmptyMessageByTab(tabName) {
  const tab = normalizeTabName(tabName);

  if (tab === "qa") return "QA類似の結果はありません。";
  if (tab === "plain") return "プレインFTSの結果はありません。";
  if (tab === "hybrid") return "ハイブリッドの結果はありません。";
  if (tab === "hybrid-ai") return "ハイブリッド+AI整理の結果はありません。";
  if (tab === "ai-answer") return "AI回答はありません。";

  return "結果はありません。";
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

  (qaItems || []).forEach((row) => {
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

  (plainItems || []).forEach((row) => {
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

  return cards;
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

  const mode = getModeByTab(currentTab);
  const resultBox = getResultBoxByTab(currentTab);
  const emptyMessage = getEmptyMessageByTab(currentTab);

  selectionSummary.textContent = `入力:検索語 ${lines.length} 行`;
  contextSummary.textContent = `DB:${currentDatabase}`;

  summaryText.textContent = "件数:検索中";
  renderEmpty(resultBox, "検索中...");

  try {
    const result = await searchByMode(currentDatabase, lines, mode);

    let cards = [];

    if (mode === "qa") {
      cards = buildQaCards(result.items || []);
    } else if (mode === "plain_fts") {
      cards = buildPlainCards(result.items || []);
    } else if (mode === "hybrid") {
      cards = buildHybridCards(
        result.qa_items || [],
        result.plain_items || []
      );
    } else {
      cards = buildPlainCards(result.items || []);
    }

    renderCards(resultBox, cards, emptyMessage);
    summaryText.textContent = `件数:${result.count || 0}件`;

  } catch (err) {
    console.error("search error", err);
    summaryText.textContent = "件数:0件";
    renderEmpty(resultBox, err.message || "検索に失敗しました。");
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
  setActiveTab("qa");

  try {
    const dbList = await fetchDatabaseList();

    renderDatabaseOptions(dbList);
    applyInitialDatabase(dbList);

    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";

    renderEmpty(
      resultQaSimilarity,
      dbList.length ? "検索文字列を入力してください。" : "データベースがありません。"
    );
    renderEmpty(
      resultPlainFts,
      dbList.length ? "検索文字列を入力してください。" : "データベースがありません。"
    );
    renderEmpty(
      resultHybrid,
      dbList.length ? "検索文字列を入力してください。" : "データベースがありません。"
    );
    renderEmpty(
      resultHybridAi,
      dbList.length ? "検索文字列を入力してください。" : "データベースがありません。"
    );
    renderEmpty(
      resultAiAnswer,
      dbList.length ? "検索文字列を入力してください。" : "データベースがありません。"
    );

  } catch (err) {
    console.error("db list load error", err);

    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";
    contextSummary.textContent = "DB:-";

    renderEmpty(resultQaSimilarity, "DB一覧の取得に失敗しました。");
    renderEmpty(resultPlainFts, "DB一覧の取得に失敗しました。");
    renderEmpty(resultHybrid, "DB一覧の取得に失敗しました。");
    renderEmpty(resultHybridAi, "DB一覧の取得に失敗しました。");
    renderEmpty(resultAiAnswer, "DB一覧の取得に失敗しました。");
  }
});
