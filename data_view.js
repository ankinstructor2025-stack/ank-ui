console.log("data_view.js loaded");

(function () {
  const API_BASE = window.API_BASE || "";
  const SOURCE_MASTER_PATH = "./source_master.json";
  const NEXT_KNOWLEDGE_PAGE = "./knowledge_build.html";

  let sourceList = [];
  let sourceMap = {};

  const state = {
    sourceType: "",
    parentRows: [],
    childRows: [],
    selectedParentKey: null,
    selectedChildKey: null,
    checkedParents: new Set()
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindElements();
    bindEvents();
    renderInitialParentPlaceholder();
    clearChildArea();
    renderDetailText("データ種別を選択してください。");
    updateSummaries();
    updateKnowledgeButton();
    await loadSourceMaster();
  }

  function bindElements() {
    el.sourceSelect = document.getElementById("sourceSelect");
    el.sourceHint = document.getElementById("sourceHint");

    el.btnReload = document.getElementById("btnReload");
    el.btnKnowledge = document.getElementById("btnKnowledge");
    el.btnBack = document.getElementById("btnBack");
    el.btnLogout = document.getElementById("btnLogout");

    el.summaryText = document.getElementById("summaryText");
    el.selectionSummary = document.getElementById("selectionSummary");
    el.contextSummary = document.getElementById("contextSummary");

    el.parentTableHead = document.getElementById("parentTableHead");
    el.parentTableBody = document.getElementById("parentTableBody");
    el.childTableHead = document.getElementById("childTableHead");
    el.childTableBody = document.getElementById("childTableBody");

    el.detailPre = document.getElementById("detailPre");
  }

  function bindEvents() {
    el.sourceSelect.addEventListener("change", async () => {
      state.sourceType = el.sourceSelect.value;
      state.parentRows = [];
      state.childRows = [];
      state.selectedParentKey = null;
      state.selectedChildKey = null;
      state.checkedParents = new Set();

      updateSourceHint();

      if (!state.sourceType) {
        renderInitialParentPlaceholder();
        clearChildArea();
        renderDetailText("データ種別を選択してください。");
        updateSummaries();
        updateKnowledgeButton();
        return;
      }

      await refreshParentList();
    });

    el.btnReload.addEventListener("click", async () => {
      if (!state.sourceType) {
        renderInitialParentPlaceholder();
        clearChildArea();
        renderDetailText("データ種別を選択してください。");
        return;
      }
      await refreshParentList();
    });

    el.btnKnowledge.addEventListener("click", () => {
      handleKnowledge();
    });

    el.btnBack.addEventListener("click", () => {
      location.href = "./menu.html";
    });

    el.btnLogout.addEventListener("click", async () => {
      try {
        if (window.firebaseAuth && typeof window.firebaseAuth.signOut === "function") {
          await window.firebaseAuth.signOut();
        }
      } catch (_) {}

      try {
        sessionStorage.removeItem("idToken");
      } catch (_) {}

      location.href = "./index.html";
    });
  }

  async function loadSourceMaster() {
    try {
      const res = await fetch(SOURCE_MASTER_PATH, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`source_master.json 読込失敗 (HTTP ${res.status})`);
      }

      const all = await res.json();

      sourceList = normalizeSourceMaster(all);
      sourceMap = Object.fromEntries(sourceList.map((item) => [item.key, item]));

      renderSourceOptions(sourceList);
      updateSourceHint();

    } catch (e) {
      console.error(e);
      el.sourceSelect.innerHTML = `<option value="">データ種別読込失敗</option>`;
      renderDetailText(`データ種別読込失敗: ${e.message}`);
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

  function renderSourceOptions(list) {
    const groups = {};

    list.forEach((item) => {
      const groupName = item.group || "その他";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });

    const html = [`<option value="">選択してください</option>`];

    Object.keys(groups).forEach((groupName) => {
      html.push(`<optgroup label="${escapeHtml(groupName)}">`);
      groups[groupName].forEach((item) => {
        html.push(
          `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
        );
      });
      html.push(`</optgroup>`);
    });

    el.sourceSelect.innerHTML = html.join("");
  }

  function updateSourceHint() {
    const item = sourceMap[state.sourceType];

    if (!item) {
      el.sourceHint.value = "データ種別を選択してください";
      return;
    }

    if (item.key === "api_kokkai") {
      el.sourceHint.value = "国会議事録: 親一覧（院 + 会議名）";
      return;
    }

    if (item.key === "api_datago") {
      el.sourceHint.value = "オープンデータ: 親一覧（opendata_documents）";
      return;
    }

    if (item.sourceType === "public_url") {
      el.sourceHint.value = `${item.label}: 親一覧（url_roots）`;
      return;
    }

    if (item.key === "file_upload") {
      el.sourceHint.value = "ファイルアップロード: 親一覧（uploaded_files）";
      return;
    }

    el.sourceHint.value = item.label || "親一覧";
  }

  async function requireIdToken() {
    const sessionToken = sessionStorage.getItem("idToken");
    if (sessionToken) {
      return sessionToken;
    }

    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
      return await window.firebaseAuth.currentUser.getIdToken(true);
    }

    throw new Error("ログイン情報が見つかりません");
  }

  async function apiGet(path, query = {}) {
    const idToken = await requireIdToken();
    const url = new URL(`${API_BASE}${path}`);

    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });

    const res = await fetch(url.toString(), {
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

  async function refreshParentList() {
    try {
      clearChildArea();
      renderDetailText("親一覧を読み込み中です...");

      const rows = await fetchParentRows(state.sourceType);
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
      renderParentError(e.message);
      renderChildTable();
      renderDetailText(e.message);
      updateSummaries();
      updateKnowledgeButton();
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

  function renderInitialParentPlaceholder() {
    el.parentTableHead.innerHTML = "";
    el.parentTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>データ種別を選択してください。</td>
      </tr>
    `;
  }

  function renderParentError(message) {
    el.parentTableHead.innerHTML = "";
    el.parentTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>${escapeHtml(message)}</td>
      </tr>
    `;
  }

  function clearChildArea() {
    el.childTableHead.innerHTML = "";
    el.childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>親一覧から1件選択してください。</td>
      </tr>
    `;
  }

  function renderParentTable() {
    if (!state.parentRows.length) {
      el.parentTableHead.innerHTML = "";
      el.parentTableBody.innerHTML = `
        <tr class="placeholder-row">
          <td>データがありません。</td>
        </tr>
      `;
      return;
    }

    const columns = getParentColumns(state.sourceType);

    el.parentTableHead.innerHTML = `
      <tr>
        ${columns.map(col => `<th class="${col.className || ""}">${escapeHtml(col.label)}</th>`).join("")}
      </tr>
    `;

    el.parentTableBody.innerHTML = state.parentRows.map((row) => {
      const rowKey = getParentRowKey(state.sourceType, row);
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

    el.parentTableBody.querySelectorAll("tr[data-parent-key]").forEach((tr) => {
      tr.addEventListener("click", async (event) => {
        if (event.target && event.target.classList.contains("parent-checkbox")) {
          return;
        }

        const rowKey = tr.dataset.parentKey;
        const row = state.parentRows.find((x) => getParentRowKey(state.sourceType, x) === rowKey);
        if (!row) return;

        state.selectedParentKey = rowKey;
        state.selectedChildKey = null;
        renderParentTable();
        await loadChildRows(row);
      });
    });

    el.parentTableBody.querySelectorAll(".parent-checkbox").forEach((checkbox) => {
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
      renderChildLoading();
      renderDetailText("子一覧を読み込み中です...");

      const rows = await fetchChildRows(state.sourceType, parentRow);
      state.childRows = rows;
      renderChildTable();
      renderDetailText("子一覧から1件選択すると詳細が表示されます。");

    } catch (e) {
      console.error(e);
      state.childRows = [];
      el.childTableHead.innerHTML = "";
      el.childTableBody.innerHTML = `
        <tr class="placeholder-row">
          <td>${escapeHtml(e.message)}</td>
        </tr>
      `;
      renderDetailText(e.message);
    }
  }

  function renderChildLoading() {
    el.childTableHead.innerHTML = "";
    el.childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>子一覧を読み込み中です...</td>
      </tr>
    `;
  }

  function renderChildTable() {
    if (!state.childRows.length) {
      el.childTableHead.innerHTML = "";
      el.childTableBody.innerHTML = `
        <tr class="placeholder-row">
          <td>子一覧はありません。</td>
        </tr>
      `;
      return;
    }

    const columns = getChildColumns(state.sourceType);

    el.childTableHead.innerHTML = `
      <tr>
        ${columns.map(col => `<th class="${col.className || ""}">${escapeHtml(col.label)}</th>`).join("")}
      </tr>
    `;

    el.childTableBody.innerHTML = state.childRows.map((row) => {
      const rowKey = getChildRowKey(state.sourceType, row);
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

    el.childTableBody.querySelectorAll("tr[data-child-key]").forEach((tr) => {
      tr.addEventListener("click", async () => {
        const rowKey = tr.dataset.childKey;
        const row = state.childRows.find((x) => getChildRowKey(state.sourceType, x) === rowKey);
        if (!row) return;

        state.selectedChildKey = rowKey;
        renderChildTable();

        const item = sourceMap[state.sourceType];
        if (item && item.sourceType === "public_url") {
          await handlePublicUrlChildClick(row);
          return;
        }

        renderDetailFromRow(row);
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

  function renderDetailFromRow(row) {
    renderDetailText(extractContentText(row));
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

  function renderDetailText(text) {
    el.detailPre.textContent = text || "";
  }

  function updateSummaries() {
    el.summaryText.textContent = `${state.parentRows.length} 件`;
    el.selectionSummary.textContent = `選択 ${state.checkedParents.size} 件`;

    const item = sourceMap[state.sourceType];
    if (!item) {
      el.contextSummary.textContent = "親一覧";
      return;
    }

    if (item.key === "api_kokkai") {
      el.contextSummary.textContent = "親一覧: 院 + 会議名";
      return;
    }

    if (item.key === "api_datago") {
      el.contextSummary.textContent = "親一覧: データセット";
      return;
    }

    if (item.sourceType === "public_url") {
      el.contextSummary.textContent = `親一覧: ${item.label}`;
      return;
    }

    if (item.key === "file_upload") {
      el.contextSummary.textContent = "親一覧: アップロードファイル";
      return;
    }

    el.contextSummary.textContent = "親一覧";
  }

  function updateKnowledgeButton() {
    el.btnKnowledge.disabled = state.checkedParents.size === 0;
  }

  function handleKnowledge() {
    const item = sourceMap[state.sourceType];
    if (!item) {
      alert("データ種別を選択してください。");
      return;
    }

    const selected = state.parentRows.filter((row) => {
      const key = getParentRowKey(state.sourceType, row);
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

  function extractSpeaker(row) {
    const content = parseContent(row && row.content);
    return (content && (content.speaker || content.speakerName || content.nameOfSpeaker)) || "";
  }

  function extractSpeech(row) {
    const content = parseContent(row && row.content);
    return (content && (content.speech || content.speechText || content.body)) || extractContentText(row);
  }

  function parseContent(content) {
    if (!content || typeof content !== "string") return null;
    try {
      return JSON.parse(content);
    } catch (_) {
      return null;
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

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
