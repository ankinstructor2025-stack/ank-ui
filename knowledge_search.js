const API_BASE = window.ANK_API_BASE;

const selectDatabase = document.getElementById("selectDatabase");
const inputSearch = document.getElementById("inputSearch");
const btnSearch = document.getElementById("btnSearch");

const tabQaSimilarity = document.getElementById("tabQaSimilarity");
const tabPlainFts = document.getElementById("tabPlainFts");
const tabHybrid = document.getElementById("tabHybrid");
const tabHybridAi = document.getElementById("tabHybridAi");
const tabAiAnswer = document.getElementById("tabAiAnswer");

const resultQaSimilarity = document.getElementById("resultQaSimilarity");
const resultPlainFts = document.getElementById("resultPlainFts");
const resultHybrid = document.getElementById("resultHybrid");
const resultHybridAi = document.getElementById("resultHybridAi");
const resultAiAnswer = document.getElementById("resultAiAnswer");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

let currentDatabase = "";
let currentTab = "qa";

let lastQaResult = null;
let lastPlainResult = null;
let lastHybridResult = null;
let lastHybridAiResult = null;
let lastAiAnswerResult = null;

function getIdToken() {
  const token = sessionStorage.getItem("idToken");
  if (!token) {
    alert("ログインが無効です");
    location.href = "login.html";
  }
  return token;
}

async function fetchApi(path, options = {}) {
  const token = getIdToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }

  return res.json();
}

function getSearchLines() {
  const text = inputSearch.value || "";
  return text
    .split("\n")
    .map(x => x.trim())
    .filter(x => x.length > 0);
}

async function loadDatabaseList() {
  const data = await fetchApi("/knowledge/dbs");

  selectDatabase.innerHTML = "";

  data.items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.db_name;
    opt.textContent = item.db_name;
    selectDatabase.appendChild(opt);
  });

  if (data.items.length) {
    currentDatabase = data.items[0].db_name;
    contextSummary.textContent = `DB:${currentDatabase}`;
  }
}

selectDatabase.addEventListener("change", () => {
  currentDatabase = selectDatabase.value;
  contextSummary.textContent = `DB:${currentDatabase}`;
});

btnSearch.addEventListener("click", executeSearch);

function renderEmpty(el, text) {
  el.innerHTML = `<div class="card-empty">${text}</div>`;
}

function buildCard(item) {

  const score = item.score != null
    ? `similarity: ${Number(item.score).toFixed(4)}`
    : "";

  const question = item.question || item.title || "";
  const answer = item.answer || item.content_preview || "";

  return `
    <div class="card">
      <div class="card-title">${question}</div>
      <div class="card-meta">
        ${item.source_type || ""} / ${item.source_label || ""} ${score}
      </div>
      <div class="card-content">${answer}</div>
    </div>
  `;
}

function buildAiAnswerCards(items) {

  if (!items.length) {
    return [`<div class="card-empty">AI回答がありません。</div>`];
  }

  return items.map(item => {

    const answer = item.answer || item.content_preview || "";

    return `
      <div class="card">
        <div class="card-title">AI回答</div>
        <div class="card-meta">
          ${item.source_type || ""} / ${item.source_label || ""}
        </div>
        <div class="card-content">${answer}</div>
      </div>
    `;
  });
}

function renderCards(container, cards, emptyText) {

  if (!cards.length) {
    renderEmpty(container, emptyText);
    return;
  }

  container.innerHTML = cards.join("");
}

function renderQaResult() {
  renderCards(
    resultQaSimilarity,
    (lastQaResult?.items || []).map(buildCard),
    "QA類似の結果はありません。"
  );
}

function renderPlainResult() {
  renderCards(
    resultPlainFts,
    (lastPlainResult?.items || []).map(buildCard),
    "FTS検索結果はありません。"
  );
}

function renderHybridResult() {
  renderCards(
    resultHybrid,
    (lastHybridResult?.items || []).map(buildCard),
    "ハイブリッド検索結果はありません。"
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

function setActiveTab(tab) {

  currentTab = tab;

  const map = {
    qa: tabQaSimilarity,
    plain: tabPlainFts,
    hybrid: tabHybrid,
    hybrid_ai: tabHybridAi,
    ai: tabAiAnswer
  };

  Object.values(map).forEach(btn => btn.classList.remove("active"));

  map[tab].classList.add("active");

  renderCurrentTab();
}

function renderCurrentTab() {

  resultQaSimilarity.style.display = "none";
  resultPlainFts.style.display = "none";
  resultHybrid.style.display = "none";
  resultHybridAi.style.display = "none";
  resultAiAnswer.style.display = "none";

  if (currentTab === "qa") resultQaSimilarity.style.display = "block";
  if (currentTab === "plain") resultPlainFts.style.display = "block";
  if (currentTab === "hybrid") resultHybrid.style.display = "block";
  if (currentTab === "hybrid_ai") resultHybridAi.style.display = "block";
  if (currentTab === "ai") resultAiAnswer.style.display = "block";
}

tabQaSimilarity.onclick = () => setActiveTab("qa");
tabPlainFts.onclick = () => setActiveTab("plain");
tabHybrid.onclick = () => setActiveTab("hybrid");
tabHybridAi.onclick = () => setActiveTab("hybrid_ai");
tabAiAnswer.onclick = () => setActiveTab("ai");

async function searchByMode(dbName, lines, mode) {

  const body = {
    db_name: dbName,
    query: lines.join("\n"),
    mode
  };

  return fetchApi("/knowledge/search", {
    method: "POST",
    body: JSON.stringify(body)
  });
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

  selectionSummary.textContent = `入力:検索語 ${lines.length} 行`;
  contextSummary.textContent = `DB:${currentDatabase}`;
  summaryText.textContent = "件数:検索中";

  renderEmpty(resultQaSimilarity, "検索中...");
  renderEmpty(resultPlainFts, "検索中...");
  renderEmpty(resultHybrid, "検索中...");
  renderEmpty(resultHybridAi, "検索中...");
  renderEmpty(resultAiAnswer, "検索中...");

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

    console.error(err);

    summaryText.textContent = "件数:0件";

    renderEmpty(resultQaSimilarity, err.message);
    renderEmpty(resultPlainFts, err.message);
    renderEmpty(resultHybrid, err.message);
    renderEmpty(resultHybridAi, err.message);
    renderEmpty(resultAiAnswer, err.message);
  }
}

async function init() {

  await loadDatabaseList();

  renderEmpty(resultQaSimilarity, "検索文字列を入力してください。");
  renderEmpty(resultPlainFts, "検索文字列を入力してください。");
  renderEmpty(resultHybrid, "検索文字列を入力してください。");
  renderEmpty(resultHybridAi, "検索文字列を入力してください。");
  renderEmpty(resultAiAnswer, "検索文字列を入力してください。");

  renderCurrentTab();
}

init();
