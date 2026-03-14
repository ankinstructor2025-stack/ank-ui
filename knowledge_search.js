console.log("knowledge_search.js loaded");

const databaseSelect = document.getElementById("databaseSelect");
const queryText = document.getElementById("queryText");

const btnSearch = document.getElementById("btnSearch");
const btnReload = document.getElementById("btnReload");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const resultQaSimilarity = document.getElementById("resultQaSimilarity");
const resultPlainFts = document.getElementById("resultPlainFts");
const resultHybrid = document.getElementById("resultHybrid");
const resultHybridAi = document.getElementById("resultHybridAi");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

let currentDatabase = "";

const demoDatabases = [
  { db_name: "knowledge_20260314183446.sqlite" },
  { db_name: "knowledge_20260315100512.sqlite" }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDatabaseOptions(list) {
  const html = [`<option value="" selected disabled>選択してください</option>`];

  list.forEach((item) => {
    html.push(
      `<option value="${escapeHtml(item.db_name)}">${escapeHtml(item.db_name)}</option>`
    );
  });

  databaseSelect.innerHTML = html.join("");
}

function renderEmpty(box, message) {
  box.innerHTML = `<div class="result-empty">${escapeHtml(message)}</div>`;
}

function buildCardHtml(item) {
  return `
    <div class="result-card">
      <div class="result-card-title">${escapeHtml(item.title || "-")}</div>
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

function setActiveTab(tabName) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${tabName}`);
  });
}

function resetAllResultAreas(message) {
  renderEmpty(resultQaSimilarity, message);
  renderEmpty(resultPlainFts, message);
  renderEmpty(resultHybrid, message);
  renderEmpty(resultHybridAi, message);
}

function getSearchLines() {
  return (queryText.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
}

function executeSearch() {
  if (!currentDatabase) {
    alert("データベースを選択してください");
    return;
  }

  const lines = getSearchLines();
  const queryLabel = lines.length ? lines.join(" / ") : "(空)";

  const qaSimilarityItems = [
    {
      title: "再エネ賦課金に関する質問",
      sub: "kokkai / 参議院 / 経済産業委員会 / score: 0.91",
      body: `検索語: ${queryLabel}\n質問に近いQA候補をここに表示します。`
    },
    {
      title: "電気料金負担への対応",
      sub: "kokkai / 衆議院 / 本会議 / score: 0.84",
      body: "QA類似度検索の結果をここに表示します。"
    }
  ];

  const plainFtsItems = [
    {
      title: "制度見直しの背景説明",
      sub: "kokkai / 参議院 / 経済産業委員会 / bm25: 12.8",
      body: `検索語: ${queryLabel}\nプレイン文書のFTS結果をここに表示します。`
    }
  ];

  const hybridItems = [
    {
      title: "再エネ賦課金に関する質問",
      sub: "QA / score: 91",
      body: "QA類似検索から採用した候補です。"
    },
    {
      title: "制度見直しの背景説明",
      sub: "plain / score: 83",
      body: "プレインFTSから採用した候補です。"
    }
  ];

  const hybridAiItems = [
    {
      title: "AI整理結果",
      sub: "統合候補を整理",
      body:
        "・主要論点: 再エネ賦課金\n" +
        "・関連テーマ: 電気料金負担、制度見直し\n" +
        "・候補の重複をまとめた表示をここに出します。"
    }
  ];

  renderCards(resultQaSimilarity, qaSimilarityItems, "QA類似の結果はありません。");
  renderCards(resultPlainFts, plainFtsItems, "プレインFTSの結果はありません。");
  renderCards(resultHybrid, hybridItems, "両方の結果はありません。");
  renderCards(resultHybridAi, hybridAiItems, "AI整理の結果はありません。");

  summaryText.textContent = `${qaSimilarityItems.length + plainFtsItems.length} 件`;
  selectionSummary.textContent = `検索語 ${lines.length} 行`;
  contextSummary.textContent = `DB: ${currentDatabase}`;
}

function bindTabEvents() {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTab(btn.dataset.tab);
    });
  });
}

function bindEvents() {
  databaseSelect.addEventListener("change", () => {
    currentDatabase = databaseSelect.value || "";
    resetAllResultAreas("検索文字列を入力して検索してください。");
    summaryText.textContent = "0 件";
    selectionSummary.textContent = "未実行";
    contextSummary.textContent = `DB: ${currentDatabase || "-"}`;
  });

  btnSearch.addEventListener("click", executeSearch);

  btnReload.addEventListener("click", () => {
    resetAllResultAreas("検索文字列を入力して検索してください。");
    summaryText.textContent = "0 件";
    selectionSummary.textContent = "未実行";
    contextSummary.textContent = `DB: ${currentDatabase || "-"}`;
  });

  btnMenu.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    window.location.href = "./index.html";
  });

  bindTabEvents();
}

document.addEventListener("DOMContentLoaded", () => {
  renderDatabaseOptions(demoDatabases);
  resetAllResultAreas("データベースを選択してください。");
  bindEvents();
});
