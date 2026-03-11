console.log("data_view.js loaded");

const sourceSelect = document.getElementById("sourceSelect");
const sourceName = document.getElementById("sourceName");

const btnReload = document.getElementById("btnReload");
const btnKnowledge = document.getElementById("btnKnowledge");
const btnMenu = document.getElementById("btnMenu");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const parentTableHead = document.getElementById("parentTableHead");
const parentTableBody = document.getElementById("parentTableBody");
const childTableHead = document.getElementById("childTableHead");
const childTableBody = document.getElementById("childTableBody");

const detailPre = document.getElementById("detailPre");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let sourceList = [];
let sourceMap = {};

const state = {
  sourceKey: "",
  parentRows: [],
  childRows: [],
  selectedParentKey: null,
  selectedChildKey: null,
  checkedParents: new Set()
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clearStateForSourceChange() {
  state.parentRows = [];
  state.childRows = [];
  state.selectedParentKey = null;
  state.selectedChildKey = null;
  state.checkedParents = new Set();
}

function renderInitialParentPlaceholder() {
  parentTableHead.innerHTML = "";
  parentTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>データ種別を選択してください。</td>
    </tr>
  `;
}

function clearChildArea() {
  childTableHead.innerHTML = "";
  childTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>親一覧から1件選択してください。</td>
    </tr>
  `;
}

function renderDetailText(text) {
  if (detailPre) {
    detailPre.textContent = text || "";
  }
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
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
      );
    });
    html.push(`</optgroup>`);
  });

  if (sourceSelect) {
    sourceSelect.innerHTML = html.join("");
  }
}

function normalizeSourceMaster(all) {
  if (!Array.isArray(all)) return [];

  const targetKeys = ["api_kokkai", "api_datago", "url_egov", "file_upload"];

  return all
    .filter((item) => targetKeys.includes(item.key))
    .map((item) => ({
      key: item.key,
      label: item.label || item.name || item.key,
      group: item.group || inferGroup(item.key, item.type),
      type: item.type || "",
      sourceType: mapKeyToSourceType(item.key, item.type)
    }));
}

function inferGroup(key, type) {
  if (key === "api_kokkai" || key === "api_datago") return "公開API";
  if (type === "public_url" || key.startsWith("url_")) return "公開URL";
  return "その他";
}

function mapKeyToSourceType(key, type) {
  if (key === "api_kokkai") return "kokkai";
  if (key === "api_datago") return "opendata";
  if (type === "public_url" || key.startsWith("url_")) return "public_url";
  if (key === "file_upload") return "upload";
  return "";
}

function updateSourceName() {
  const item = sourceMap[state.sourceKey];
  if (sourceName) {
    sourceName.value = item ? item.label : "";
  }
}

function updateSummaries() {
  if (summaryText) {
    summaryText.textContent = `${state.parentRows.length} 件`;
  }

  if (selectionSummary) {
    selectionSummary.textContent = `選択 ${state.checkedParents.size} 件`;
  }

  const item = sourceMap[state.sourceKey];
  if (!item) {
    contextSummary.textContent = "親一覧";
    return;
  }

  if (item.key === "api_kokkai") {
    contextSummary.textContent = "親一覧: 院 + 会議名";
    return;
  }

  if (item.key === "api_datago") {
    contextSummary.textContent = "親一覧: データセット";
    return;
  }

  if (item.sourceType === "public_url") {
    contextSummary.textContent = `親一覧: ${item.label}`;
    return;
  }

  if (item.key === "file_upload") {
    contextSummary.textContent = "親一覧: アップロードファイル";
    return;
  }

  contextSummary.textContent = "親一覧";
}

function updateKnowledgeButton() {
  if (btnKnowledge) {
    btnKnowledge.disabled = state.checkedParents.size === 0;
  }
}

function getIdToken() {
  return sessionStorage.getItem("idToken");
}

function requireIdToken() {
  const idToken = getIdToken();
  if (!idToken) {
    throw new Error("ログイン情報が見つかりません");
  }
  return idToken;
}

function buildApiUrl(path, query = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = `${API_BASE}${normalizedPath}`;
  const url = new URL(fullUrl);

  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  return url.toString();
}

async function apiGet(path, query = {}) {
  const idToken = requireIdToken();
  const url = buildApiUrl(path, query);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    let detail = `APIエラー (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data && data.detail) detail = data.detail;
    } catch (_) {}
    throw new Error(detail);
  }

  return await res.json();
}

async function loadSourceMaster() {
  try {
    const res = await fetch("./source_master.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    sourceList = normalizeSourceMaster(await res.json());
    sourceMap = Object.fromEntries(sourceList.map((item) => [item.key, item]));
    renderSourceOptions(sourceList);
    updateSourceName();
  } catch (e) {
    console.error(e);
    if (sourceSelect) {
      sourceSelect.innerHTML = `<option value="" selected>データ種別読込失敗</option>`;
    }
    renderDetailText(`データ種別読込失敗: ${e.message}`);
  }
}

async function fetchParentRows(sourceKey) {
  const item = sourceMap[sourceKey];
  if (!item) return [];

  if (item.key === "api_kokkai") {
    const data = await apiGet("/kokkai/documents");
    return Array.isArray(data.rows) ? data.rows : [];
  }

  if (item.key === "api_datago") {
    const data = await apiGet("/opendata/documents");
    return Array.isArray(data.rows) ? data.rows : [];
  }

  if (item.sourceType === "public_url") {
    const data = await apiGet("/public-url/roots", {
      source_key: item.key
    });
    return Array.isArray(data.rows) ? data.rows : [];
  }

  if (item.key === "file_upload") {
    const data = await apiGet("/uploaded-files");
    return Array.isArray(data.rows) ? data.rows : [];
  }

  return [];
}

async function fetchChildRows(sourceKey, parentRow) {
  const item = sourceMap[sourceKey];
  if (!item || !parentRow) return [];

  if (item.key === "api_kokkai") {
    const data = await apiGet("/kokkai/rows", {
      name_of_house: parentRow.name_of_house,
      name_of_meeting: parentRow.name_of_meeting
    });
    return Array.isArray(data.rows) ? data.rows : [];
  }

  if (item.key === "api_datago") {
    const data = await apiGet("/row_data/by_file", {
      file_id: parentRow.source_id
    });
    return Array.isArray(data.rows) ? data.rows : [];
  }

  if (item.sourceType === "public_url") {
    const data = await apiGet("/public-url/pages", {
      root_id: parentRow.root_id
    });
    return Array.isArray(data.rows) ? data.rows : [];
  }

  if (item.key === "file_upload") {
    const data = await apiGet("/row_data/by_file", {
      file_id: parentRow.file_id
    });
    return Array.isArray(data.rows) ? data.rows : [];
  }

  return [];
}

async function fetchGrandChildRowsForPublicUrl(pageRow) {
  if (!pageRow) return [];

  const data = await apiGet("/row_data/by_file", {
    file_id: pageRow.page_id
  });

  return Array.isArray(data.rows) ? data.rows : [];
}

async function refreshParentList() {
  try {
    clearChildArea();
    renderDetailText("親一覧を読み込み中です...");

    const rows = await fetchParentRows(state.sourceKey);
    state.parentRows = rows;
    state.childRows = [];
    state.selectedParentKey = null;
    state.selectedChildKey = null;
    state.checkedParents = new Set();

    renderParentTable();
    renderChildTable();
    renderDetailText("親一覧から1件選択すると、子一覧と詳細が表示されます。");
    updateSummaries();
    updateKnowledgeButton();

  } catch (e) {
    console.error(e);
    state.parentRows = [];
    state.childRows = [];
    parentTableHead.innerHTML = "";
    parentTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>${escapeHtml(e.message)}</td>
      </tr>
    `;
    childTableHead.innerHTML = "";
    childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>子一覧はありません。</td>
      </tr>
    `;
    renderDetailText(e.message);
    updateSummaries();
    updateKnowledgeButton();
  }
}

function renderStatus(status) {
  const s = String(status || "").toLowerCase();

  if (s === "done") {
    return `<span class="status-pill status-done">done</span>`;
  }
  if (s === "error" || s === "fetch_error") {
    return `<span class="status-pill status-error">error</span>`;
  }
  return `<span class="status-pill status-new">new</span>`;
}

function renderLink(url) {
  const v = String(url || "");
  return `<span class="table-cell-link"><a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v)}</a></span>`;
}

function parseContent(content) {
  if (!content || typeof content !== "string") return null;
  try {
    return JSON.parse(content);
  } catch (_) {
    return null;
  }
}

function extractSpeaker(row) {
  const content = parseContent(row && row.content);
  return (content && (content.speaker || content.speakerName || content.nameOfSpeaker)) || "";
}

function extractSpeech(row) {
  const content = parseContent(row && row.content);
  return (content && (content.speech || content.speechText || content.body)) || extractContentText(row);
}

function extractContentText(row) {
  const content = row && row.content != null ? row.content : "";

  if (typeof content !== "string") {
    try {
      return JSON.stringify(content, null, 2);
    } catch (_) {
      return String(content);
    }
  }

  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch (_) {
    return content;
  }
}

function shorten(text, maxLen) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

function toDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getParentColumns(sourceKey) {
  const item = sourceMap[sourceKey];

  if (item && item.key === "api_kokkai") {
    return [
      { type: "checkbox", label: "", className: "checkbox-cell" },
      { key: "name_of_house", label: "院", className: "medium-cell" },
      { key: "name_of_meeting", label: "会議名" },
      { key: "row_count", label: "件数", className: "narrow-cell" },
      { key: "status", label: "状態", className: "narrow-cell", render: (row) => renderStatus(row.status) }
    ];
  }

  if (item && item.key === "api_datago") {
    return [
      { type: "checkbox", label: "", className: "checkbox-cell" },
      { key: "logical_name", label: "タイトル" },
      { key: "ext", label: "ext", className: "narrow-cell" },
      { key: "row_count", label: "件数", className: "narrow-cell" },
      { key: "status", label: "状態", className: "narrow-cell", render: (row) => renderStatus(row.status) }
    ];
  }

  if (item && item.sourceType === "public_url") {
    return [
      { type: "checkbox", label: "", className: "checkbox-cell" },
      { key: "root_url", label: "ルートURL", render: (row) => renderLink(row.root_url) },
      { key: "source_type", label: "種別", className: "medium-cell", render: (row) => escapeHtml(row.source_type || "") },
      { key: "created_at", label: "作成日", className: "medium-cell", render: (row) => escapeHtml(toDate(row.created_at)) }
    ];
  }

  return [
    { type: "checkbox", label: "", className: "checkbox-cell" },
    { key: "logical_name", label: "ファイル名" },
    { key: "ext", label: "ext", className: "narrow-cell" },
    { key: "created_at", label: "作成日", className: "medium-cell", render: (row) => escapeHtml(toDate(row.created_at)) }
  ];
}

function getChildColumns(sourceKey) {
  const item = sourceMap[sourceKey];

  if (item && item.key === "api_kokkai") {
    return [
      { key: "row_index", label: "No", className: "narrow-cell" },
      { key: "speaker", label: "発言者", className: "medium-cell", render: (row) => escapeHtml(extractSpeaker(row)) },
      { key: "speech", label: "内容", render: (row) => escapeHtml(shorten(extractSpeech(row), 120)) }
    ];
  }

  if (item && item.key === "api_datago") {
    return [
      { key: "row_index", label: "No", className: "narrow-cell" },
      { key: "content", label: "概要", render: (row) => escapeHtml(shorten(extractContentText(row), 120)) }
    ];
  }

  if (item && item.sourceType === "public_url") {
    return [
      { key: "depth", label: "階層", className: "narrow-cell" },
      { key: "page_type", label: "種別", className: "narrow-cell", render: (row) => escapeHtml(row.page_type || "") },
      { key: "score", label: "評価", className: "narrow-cell", render: (row) => escapeHtml(row.score ?? "") },
      { key: "status", label: "状態", className: "narrow-cell", render: (row) => renderStatus(row.status) },
      { key: "page_url", label: "ページURL", render: (row) => renderLink(row.page_url) }
    ];
  }

  return [
    { key: "row_index", label: "No", className: "narrow-cell" },
    { key: "content", label: "概要", render: (row) => escapeHtml(shorten(extractContentText(row), 120)) }
  ];
}

function getParentRowKey(sourceKey, row) {
  const item = sourceMap[sourceKey];

  if (item && item.key === "api_kokkai") {
    return `${row.name_of_house}__${row.name_of_meeting}`;
  }

  if (item && item.key === "api_datago") {
    return String(row.source_id);
  }

  if (item && item.sourceType === "public_url") {
    return String(row.root_id);
  }

  return String(row.file_id);
}

function getChildRowKey(sourceKey, row) {
  const item = sourceMap[sourceKey];

  if (item && item.sourceType === "public_url") {
    return String(row.page_id);
  }

  return String(row.row_id || `${row.file_id}_${row.row_index}`);
}

function renderParentTable() {
  if (!state.parentRows.length) {
    parentTableHead.innerHTML = "";
    parentTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>データがありません。</td>
      </tr>
    `;
    return;
  }

  const columns = getParentColumns(state.sourceKey);

  parentTableHead.innerHTML = `
    <tr>
      ${columns.map(col => `<th class="${col.className || ""}">${escapeHtml(col.label)}</th>`).join("")}
    </tr>
  `;

  parentTableBody.innerHTML = state.parentRows.map((row) => {
    const rowKey = getParentRowKey(state.sourceKey, row);
    const checked = state.checkedParents.has(rowKey) ? "checked" : "";
    const rowClass = state.selectedParentKey === rowKey ? "selected-row" : "clickable-row";

    return `
      <tr class="${rowClass}" data-parent-key="${escapeHtml(rowKey)}">
        ${columns.map((col) => {
          if (col.type === "checkbox") {
            return `
              <td class="checkbox-cell">
                <input
                  type="checkbox"
                  class="parent-checkbox"
                  data-parent-key="${escapeHtml(rowKey)}"
                  ${checked}
                />
              </td>
            `;
          }

          const value = col.render ? col.render(row) : escapeHtml(row[col.key] ?? "");
          return `<td>${value}</td>`;
        }).join("")}
      </tr>
    `;
  }).join("");

  parentTableBody.querySelectorAll("tr[data-parent-key]").forEach((tr) => {
    tr.addEventListener("click", async (event) => {
      if (event.target && event.target.classList.contains("parent-checkbox")) return;

      const rowKey = tr.dataset.parentKey;
      const row = state.parentRows.find((x) => getParentRowKey(state.sourceKey, x) === rowKey);
      if (!row) return;

      state.selectedParentKey = rowKey;
      state.selectedChildKey = null;
      renderParentTable();
      await loadChildRows(row);
    });
  });

  parentTableBody.querySelectorAll(".parent-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    checkbox.addEventListener("change", () => {
      const rowKey = checkbox.dataset.parentKey;
      if (!rowKey) return;

      if (checkbox.checked) {
        state.checkedParents.add(rowKey);
      } else {
        state.checkedParents.delete(rowKey);
      }

      updateSummaries();
      updateKnowledgeButton();
    });
  });
}

async function loadChildRows(parentRow) {
  try {
    childTableHead.innerHTML = "";
    childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>子一覧を読み込み中です...</td>
      </tr>
    `;
    renderDetailText("子一覧を読み込み中です...");

    const rows = await fetchChildRows(state.sourceKey, parentRow);
    state.childRows = rows;
    renderChildTable();
    renderDetailText("子一覧から1件選択すると詳細が表示されます。");

  } catch (e) {
    console.error(e);
    state.childRows = [];
    childTableHead.innerHTML = "";
    childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>${escapeHtml(e.message)}</td>
      </tr>
    `;
    renderDetailText(e.message);
  }
}

function renderChildTable() {
  if (!state.childRows.length) {
    childTableHead.innerHTML = "";
    childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>子一覧はありません。</td>
      </tr>
    `;
    return;
  }

  const columns = getChildColumns(state.sourceKey);

  childTableHead.innerHTML = `
    <tr>
      ${columns.map(col => `<th class="${col.className || ""}">${escapeHtml(col.label)}</th>`).join("")}
    </tr>
  `;

  childTableBody.innerHTML = state.childRows.map((row) => {
    const rowKey = getChildRowKey(state.sourceKey, row);
    const rowClass = state.selectedChildKey === rowKey ? "selected-row" : "clickable-row";

    return `
      <tr class="${rowClass}" data-child-key="${escapeHtml(rowKey)}">
        ${columns.map((col) => {
          const value = col.render ? col.render(row) : escapeHtml(row[col.key] ?? "");
          return `<td>${value}</td>`;
        }).join("")}
      </tr>
    `;
  }).join("");

  childTableBody.querySelectorAll("tr[data-child-key]").forEach((tr) => {
    tr.addEventListener("click", async () => {
      const rowKey = tr.dataset.childKey;
      const row = state.childRows.find((x) => getChildRowKey(state.sourceKey, x) === rowKey);
      if (!row) return;

      state.selectedChildKey = rowKey;
      renderChildTable();

      const item = sourceMap[state.sourceKey];
      if (item && item.sourceType === "public_url") {
        await handlePublicUrlChildClick(row);
        return;
      }

      renderDetailText(extractContentText(row));
    });
  });
}

async function handlePublicUrlChildClick(pageRow) {
  try {
    renderDetailText("公開URLの row_data を読み込み中です...");
    const rows = await fetchGrandChildRowsForPublicUrl(pageRow);

    if (!rows.length) {
      renderDetailText("このページには row_data がありません。");
      return;
    }

    const text = rows.map((r) => {
      const title = `row_index: ${r.row_index ?? ""}`;
      const body = extractContentText(r);
      return `${title}\n${body}`;
    }).join("\n\n----------------\n\n");

    renderDetailText(text);

  } catch (e) {
    console.error(e);
    renderDetailText(e.message);
  }
}

function handleKnowledge() {
  const item = sourceMap[state.sourceKey];
  if (!item) {
    alert("データ種別を選択してください。");
    return;
  }

  const selected = state.parentRows.filter((row) => {
    const key = getParentRowKey(state.sourceKey, row);
    return state.checkedParents.has(key);
  });

  if (!selected.length) {
    alert("親一覧から対象を選択してください。");
    return;
  }

  const payload = {
    source_key: item.key,
    source_type: item.sourceType,
    source_info: item,
    selected_parents: selected,
    created_at: new Date().toISOString()
  };

  sessionStorage.setItem("knowledge_targets", JSON.stringify(payload));
  alert("選択対象を保存しました。");
  location.href = NEXT_KNOWLEDGE_PAGE;
}

if (btnMenu) {
  btnMenu.addEventListener("click", () => {
    window.location.href = "menu.html";
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    window.location.href = "index.html";
  });
}

if (btnReload) {
  btnReload.addEventListener("click", async () => {
    if (!state.sourceKey) {
      renderInitialParentPlaceholder();
      clearChildArea();
      renderDetailText("データ種別を選択してください。");
      return;
    }
    await refreshParentList();
  });
}

if (btnKnowledge) {
  btnKnowledge.addEventListener("click", handleKnowledge);
}

if (sourceSelect) {
  sourceSelect.addEventListener("change", async () => {
    state.sourceKey = sourceSelect.value;
    clearStateForSourceChange();
    updateSourceName();

    if (!state.sourceKey) {
      renderInitialParentPlaceholder();
      clearChildArea();
      renderDetailText("データ種別を選択してください。");
      updateSummaries();
      updateKnowledgeButton();
      return;
    }

    await refreshParentList();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderInitialParentPlaceholder();
  clearChildArea();
  renderDetailText("データ種別を選択してください。");
  updateSummaries();
  updateKnowledgeButton();
  await loadSourceMaster();
});
