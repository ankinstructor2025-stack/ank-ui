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
  const src = String(tabName || "").trim().toLowerCase();

  if (src === "qa" || src === "qa-similarity") return "qa";
  if (src === "plain-fts" || src === "plain_fts" || src === "fts") return "plain-fts";
  if (src === "hybrid") return "hybrid";
  if (src === "hybrid-ai" || src === "hybrid_ai") return "hybrid-ai";
  if (src === "ai-answer" || src === "ai_answer" || src === "ai") return "ai-answer";

  return "qa";
}

function getResultBoxByTab(tabName) {
  const normalized = normalizeTabName(tabName);

  switch (normalized) {
    case "qa":
      return resultQaSimilarity;
    case "plain-fts":
      return resultPlainFts;
    case "hybrid":
      return resultHybrid;
    case "hybrid-ai":
      return resultHybridAi;
    case "ai-answer":
      return resultAiAnswer;
    default:
      return resultQaSimilarity;
  }
}

function getModeByTab(tabName) {
  const normalized = normalizeTabName(tabName);

  switch (normalized) {
    case "qa":
      return "qa";
    case "plain-fts":
      return "plain_fts";
    case "hybrid":
      return "hybrid";
    case "hybrid-ai":
      return "hybrid_ai";
    case "ai-answer":
      return "ai_answer";
    default:
      return "qa";
  }
}

function getEmptyMessageByTab(tabName) {
  const normalized = normalizeTabName(tabName);

  switch (normalized) {
    case "qa":
      return "QA類似の結果はありません。";
    case "plain-fts":
      return "プレインFTSの結果はありません。";
    case "hybrid":
      return "ハイブリッドの結果はありません。";
    case "hybrid-ai":
      return "ハイブリッド+AI整理の結果はありません。";
    case "ai-answer":
      return "AI回答はありません。";
    default:
      return "結果はありません。";
  }
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
  if (!box) return;
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
  if (!box) return;

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
  currentTab = normalizeTabName(tabName);

  tabButtons.forEach((btn) => {
    const btnTab = normalizeTabName(btn.dataset.tab);
    btn.classList.toggle("active", btnTab === currentTab);
  });

  tabPanels.forEach((panel) => {
    const panelTab = normalizeTabName(panel.id.replace("panel-", ""));
    panel.classList.toggle("active", panelTab === currentTab);
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

async function searchByMode(dbName, lines, mode) {
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
    throw new Error(
      data.detail || "検索に失敗しました。"
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

function buildQaCards(items) {
  return (items || []).map((row) => {
    const subParts = [];

    if (row.source_type) {
      subParts.push(row.source_type);
    }

    if (row.source_label) {
      subParts.push(row.source_label);
    }

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

    if (row.source_type) {
      subParts.push(row.source_type);
    }

    if (row.source_label) {
      subParts.push(row.source_label);
    }

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

  selectionSummary.textContent =
    `入力:検索語 ${lines.length} 行`;

  contextSummary.textContent =
    `DB:${currentDatabase}`;

  summaryText.textContent = "件数:検索中";
  renderEmpty(resultBox, "検索中...");

  try {
    const result =
      await searchByMode(currentDatabase, lines, mode);

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

    renderCards(
      resultBox,
      cards,
      emptyMessage
    );

    summaryText.textContent =
      `件数:${result.count || 0}件`;

  } catch (err) {
    console.error("search error", err);

    summaryText.textContent = "件数:0件";

    renderEmpty(
      resultBox,
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
  setActiveTab(currentTab);

  try {
    const dbList = await fetchDatabaseList();

    renderDatabaseOptions(dbList);
    applyInitialDatabase(dbList);

    summaryText.textContent = "件数:0件";
    selectionSummary.textContent = "入力:未実行";

    renderEmpty(
      resultQaSimilarity,
      dbList.length
        ? "検索文字列を入力してください。"
        : "データベースがありません。"
    );
    renderEmpty(
      resultPlainFts,
      dbList.length
        ? "検索文字列を入力してください。"
        : "データベースがありません。"
    );
    renderEmpty(
      resultHybrid,
      dbList.length
        ? "検索文字列を入力してください。"
        : "データベースがありません。"
    );
    renderEmpty(
      resultHybridAi,
      dbList.length
        ? "検索文字列を入力してください。"
        : "データベースがありません。"
    );
    renderEmpty(
      resultAiAnswer,
      dbList.length
        ? "検索文字列を入力してください。"
        : "データベースがありません。"
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
