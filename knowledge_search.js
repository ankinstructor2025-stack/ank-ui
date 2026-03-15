console.log("knowledge_search.js loaded");

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
  renderEmpty(resultAiAnswer, message);
}

function getSearchLines() {
  return (queryText.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
}

function getIdToken() {
  return (
    sessionStorage.getItem("idToken") ||
    localStorage.getItem("idToken") ||
    ""
  );
}

function buildPlainCards(items) {
  return (items || []).map((row) => {
    const subParts = [];

    if (row.source_type) subParts.push(row.source_type);
    if (row.source_label) subParts.push(row.source_label);
    if (row.score !== undefined && row.score !== null) {
      subParts.push(`bm25: ${row.score}`);
    }

    return {
      title: row.title || "タイトルなし",
      sub: subParts.join(" / "),
      body: row.content_preview || row.content || ""
    };
  });
}

async function searchPlainFts(dbName, lines) {
  const query = lines.join("\n");
  const idToken = getIdToken();

  const response = await fetch("/v1/knowledge/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": idToken ? `Bearer ${idToken}` : ""
    },
    body: JSON.stringify({
      db_name: dbName,
      query: query,
      mode: "plain_fts"
    })
  });

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.detail || "プレインFTS検索に失敗しました。");
  }

  return data;
}

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

  selectionSummary.textContent = `検索語 ${lines.length} 行`;
  contextSummary.textContent = currentDatabase;
  summaryText.textContent = "検索中...";

  renderEmpty(resultQaSimilarity, "未実装です。");
  renderEmpty(resultPlainFts, "検索中...");
  renderEmpty(resultHybrid, "未実装です。");
  renderEmpty(resultHybridAi, "未実装です。");
  renderEmpty(resultAiAnswer, "未実装です。");

  try {
    const plainResult = await searchPlainFts(currentDatabase, lines);
    const plainCards = buildPlainCards(plainResult.items || []);

    renderCards(
      resultPlainFts,
      plainCards,
      "プレインFTSの結果はありません。"
    );

    summaryText.textContent = `${plainResult.count || 0} 件`;

  } catch (err) {
    console.error("executeSearch error:", err);
    summaryText.textContent = "0 件";
    renderEmpty(
      resultPlainFts,
      err.message || "プレインFTS検索でエラーが発生しました。"
    );
  }
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
    contextSummary.textContent = currentDatabase || "-";
  });

  btnSearch.addEventListener("click", executeSearch);

  btnMenu.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    sessionStorage.removeItem("user");
    localStorage.removeItem("idToken");
    localStorage.removeItem("user");
    window.location.href = "./index.html";
  });

  bindTabEvents();
}

document.addEventListener("DOMContentLoaded", () => {
  renderDatabaseOptions(demoDatabases);
  resetAllResultAreas("データベースを選択してください。");
  bindEvents();
});
