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

const resultTableHead = document.getElementById("resultTableHead");
const resultTableBody = document.getElementById("resultTableBody");
const detailPre = document.getElementById("detailPre");

let currentDatabase = "";
let selectedEntryId = "";

const demoDatabases = [
  {
    db_name: "knowledge_20260314183446.sqlite"
  },
  {
    db_name: "knowledge_20260315100512.sqlite"
  }
];

const demoResults = [
  {
    entry_id: "e001",
    title: "再エネ賦課金に関する質問",
    source_type: "kokkai",
    source_label: "参議院 / 経済産業委員会",
    question: "再エネ賦課金の見直し方針はどうなっていますか。",
    answer: "政府としては国民負担や電力価格への影響を踏まえつつ制度全体の見直しを検討している。",
    content: "",
    data_kind: "qa"
  },
  {
    entry_id: "e002",
    title: "制度見直しの背景説明",
    source_type: "kokkai",
    source_label: "参議院 / 経済産業委員会",
    question: "",
    answer: "",
    content: "制度開始以降、再生可能エネルギー導入量は増加した一方で国民負担とのバランスが継続的な論点となっている。",
    data_kind: "plain"
  },
  {
    entry_id: "e003",
    title: "電気料金負担への対応",
    source_type: "kokkai",
    source_label: "衆議院 / 本会議",
    question: "電気料金負担の軽減策はありますか。",
    answer: "負担軽減のための支援策や制度のあり方について関係省庁で連携して検討している。",
    content: "",
    data_kind: "qa"
  }
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

function renderResultPlaceholder(message) {
  resultTableHead.innerHTML = "";

  resultTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderInitialScreen() {
  renderResultPlaceholder("データベースを選択してください。");
  detailPre.textContent = "データベースを選択してください。";
  summaryText.textContent = "0 件";
  selectionSummary.textContent = "選択なし";
  contextSummary.textContent = "検索結果一覧";
}

function renderResultTable(rows) {
  resultTableHead.innerHTML = `
    <tr>
      <th>タイトル</th>
      <th style="width:110px;">source</th>
    </tr>
  `;

  if (!rows.length) {
    resultTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td colspan="2">該当データはありません。</td>
      </tr>
    `;
    return;
  }

  resultTableBody.innerHTML = rows.map((row) => `
    <tr class="clickable-row ${row.entry_id === selectedEntryId ? "selected-row" : ""}" data-entry-id="${escapeHtml(row.entry_id)}">
      <td>
        <div class="result-title">${escapeHtml(row.title || "-")}</div>
        <div class="result-sub">${escapeHtml(row.source_label || "")}</div>
      </td>
      <td>${escapeHtml(row.source_type || "-")}</td>
    </tr>
  `).join("");
}

function buildDetailText(row) {
  const lines = [];

  lines.push(`entry_id: ${row.entry_id || ""}`);
  lines.push(`title: ${row.title || ""}`);
  lines.push(`source_type: ${row.source_type || ""}`);
  lines.push(`source_label: ${row.source_label || ""}`);
  lines.push("");

  if (row.question) {
    lines.push("[質問]");
    lines.push(row.question);
    lines.push("");
  }

  if (row.answer) {
    lines.push("[回答]");
    lines.push(row.answer);
    lines.push("");
  }

  if (row.content) {
    lines.push("[内容]");
    lines.push(row.content);
    lines.push("");
  }

  return lines.join("\n");
}

function showDetailByEntryId(entryId) {
  const row = demoResults.find((item) => item.entry_id === entryId);

  if (!row) {
    detailPre.textContent = "詳細を表示できません。";
    return;
  }

  selectedEntryId = entryId;
  detailPre.textContent = buildDetailText(row);
  selectionSummary.textContent = `選択: ${row.title || row.entry_id}`;
  renderResultTable(getFilteredResults());
}

function getSearchLines() {
  return (queryText.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line);
}

function getSearchTargetText(row) {
  return [
    row.title,
    row.question,
    row.answer,
    row.content,
    row.source_label,
    row.source_type
  ].join(" ").toLowerCase();
}

function getFilteredResults() {
  const lines = getSearchLines();

  return demoResults.filter((row) => {
    if (!lines.length) {
      return true;
    }

    const target = getSearchTargetText(row);

    return lines.some((line) => target.includes(line));
  });
}

function executeSearch() {
  if (!currentDatabase) {
    alert("データベースを選択してください");
    return;
  }

  const rows = getFilteredResults();
  selectedEntryId = "";

  renderResultTable(rows);

  detailPre.textContent = rows.length
    ? "一覧から1件選択してください。"
    : "該当データはありません。";

  summaryText.textContent = `${rows.length} 件`;
  selectionSummary.textContent = "選択なし";
  contextSummary.textContent = `DB: ${currentDatabase}`;
}

function bindResultClick() {
  resultTableBody.addEventListener("click", (event) => {
    const tr = event.target.closest("tr[data-entry-id]");
    if (!tr) return;

    const entryId = tr.getAttribute("data-entry-id");
    if (!entryId) return;

    showDetailByEntryId(entryId);
  });
}

function resetSearchArea(message) {
  renderResultPlaceholder(message);
  detailPre.textContent = message;
  summaryText.textContent = "0 件";
  selectionSummary.textContent = "選択なし";
}

function bindEvents() {
  databaseSelect.addEventListener("change", () => {
    currentDatabase = databaseSelect.value || "";
    resetSearchArea("検索文字列を入力して検索してください。");
    contextSummary.textContent = `DB: ${currentDatabase || "-"}`;
  });

  btnSearch.addEventListener("click", executeSearch);

  btnReload.addEventListener("click", () => {
    resetSearchArea("検索文字列を入力して検索してください。");
    contextSummary.textContent = `DB: ${currentDatabase || "-"}`;
  });

  btnMenu.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    window.location.href = "./index.html";
  });

  bindResultClick();
}

document.addEventListener("DOMContentLoaded", () => {
  renderInitialScreen();
  renderDatabaseOptions(demoDatabases);
  bindEvents();
});
