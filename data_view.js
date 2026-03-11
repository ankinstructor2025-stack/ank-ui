console.log("data_view.js loaded");

(function () {
  const API_BASE = window.API_BASE || "";
  const NEXT_KNOWLEDGE_PAGE = "./knowledge_build.html";

  let state = {
    sourceType: "kokkai",
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
    await refreshParentList();
  }

  function bindElements() {
    el.sourceType = document.getElementById("sourceType");
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

    el.detailCard = document.getElementById("detailCard");
  }

  function bindEvents() {
    el.sourceType.addEventListener("change", async () => {
      state.sourceType = el.sourceType.value;
      state.parentRows = [];
      state.childRows = [];
      state.selectedParentKey = null;
      state.selectedChildKey = null;
      state.checkedParents = new Set();
      updateSourceHint();
      await refreshParentList();
    });

    el.btnReload.addEventListener("click", async () => {
      await refreshParentList();
    });

    el.btnKnowledge.addEventListener("click", () => {
      handleKnowledge();
    });

    el.btnBack.addEventListener("click", () => {
      location.href = "./index.html";
    });

    el.btnLogout.addEventListener("click", async () => {
      if (window.firebaseAuth && typeof window.firebaseAuth.signOut === "function") {
        await window.firebaseAuth.signOut();
      }
      location.href = "./login.html";
    });

    updateSourceHint();
  }

  function updateSourceHint() {
    const map = {
      kokkai: "国会議事録: 親一覧（院 + 会議名）",
      opendata: "オープンデータ: 親一覧（opendata_documents）",
      public_url: "公開URL: 親一覧（url_roots）",
      upload: "アップロード: 親一覧（uploaded_files）"
    };
    el.sourceHint.value = map[state.sourceType] || "親一覧を表示します";
  }

  async function getIdToken() {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
      throw new Error("ログイン情報が見つかりません");
    }
    return await window.firebaseAuth.currentUser.getIdToken(true);
  }

  async function apiGet(path, query = {}) {
    const idToken = await getIdToken();
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

  async function fetchParentRows(sourceType) {
    if (sourceType === "kokkai") {
      const data = await apiGet("/v1/kokkai/documents");
      return Array.isArray(data.rows) ? data.rows : [];
    }

    if (sourceType === "opendata") {
      const data = await apiGet("/v1/opendata/documents");
      return Array.isArray(data.rows) ? data.rows : [];
    }

    if (sourceType === "public_url") {
      const data = await apiGet("/v1/public-url/roots");
      return Array.isArray(data.rows) ? data.rows : [];
    }

    if (sourceType === "upload") {
      const data = await apiGet("/v1/uploaded-files");
      return Array.isArray(data.rows) ? data.rows : [];
    }

    return [];
  }

  async function fetchChildRows(sourceType, parentRow) {
    if (!parentRow) return [];

    if (sourceType === "kokkai") {
      const data = await apiGet("/v1/kokkai/rows", {
        name_of_house: parentRow.name_of_house,
        name_of_meeting: parentRow.name_of_meeting
      });
      return Array.isArray(data.rows) ? data.rows : [];
    }

    if (sourceType === "opendata") {
      const data = await apiGet("/v1/row_data/by_file", {
        file_id: parentRow.source_id
      });
      return Array.isArray(data.rows) ? data.rows : [];
    }

    if (sourceType === "public_url") {
      const data = await apiGet("/v1/public-url/pages", {
        root_id: parentRow.root_id
      });
      return Array.isArray(data.rows) ? data.rows : [];
    }

    if (sourceType === "upload") {
      const data = await apiGet("/v1/row_data/by_file", {
        file_id: parentRow.file_id
      });
      return Array.isArray(data.rows) ? data.rows : [];
    }

    return [];
  }

  async function fetchGrandChildRowsForPublicUrl(pageRow) {
    if (!pageRow) return [];
    const data = await apiGet("/v1/row_data/by_file", {
      file_id: pageRow.page_id
    });
    return Array.isArray(data.rows) ? data.rows : [];
  }

  function renderParentError(message) {
    el.parentTableHead.innerHTML = "";
    el.parentTableBody.innerHTML = `
      <tr>
        <td class="placeholder">${escapeHtml(message)}</td>
      </tr>
    `;
  }

  function clearChildArea() {
    el.childTableHead.innerHTML = "";
    el.childTableBody.innerHTML = `
      <tr><td class="placeholder">親一覧から1件選択してください。</td></tr>
    `;
  }

  function renderParentTable() {
    if (!state.parentRows.length) {
      el.parentTableHead.innerHTML = "";
      el.parentTableBody.innerHTML = `
        <tr><td class="placeholder">データがありません。</td></tr>
      `;
      return;
    }

    const columns = getParentColumns(state.sourceType);

    el.parentTableHead.innerHTML = `
      <tr>
        ${columns.map(col => `<th style="${col.width ? `width:${col.width};` : ""}">${escapeHtml(col.label)}</th>`).join("")}
      </tr>
    `;

    el.parentTableBody.innerHTML = state.parentRows.map((row) => {
      const rowKey = getParentRowKey(state.sourceType, row);
      const checked = state.checkedParents.has(rowKey) ? "checked" : "";
      const selectedClass = state.selectedParentKey === rowKey ? "is-selected" : "is-clickable";

      return `
        <tr class="${selectedClass}" data-parent-key="${escapeHtml(rowKey)}">
          ${columns.map(col => {
            if (col.type === "checkbox") {
              return `
                <td>
                  <input
                    type="checkbox"
                    class="parent-checkbox"
                    data-parent-key="${escapeHtml(rowKey)}"
                    ${checked}
                  />
                </td>
              `;
            }

            const value = col.render ? col.render(row) : row[col.key];
            return `<td>${value == null ? "" : value}</td>`;
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
        const row = state.parentRows.find(x => getParentRowKey(state.sourceType, x) === rowKey);
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
      updateSummaries();

    } catch (e) {
      console.error(e);
      state.childRows = [];
      el.childTableHead.innerHTML = "";
      el.childTableBody.innerHTML = `
        <tr><td class="placeholder">${escapeHtml(e.message)}</td></tr>
      `;
      renderDetailText(e.message);
    }
  }

  function renderChildLoading() {
    el.childTableHead.innerHTML = "";
    el.childTableBody.innerHTML = `
      <tr><td class="placeholder">子一覧を読み込み中です...</td></tr>
    `;
  }

  function renderChildTable() {
    if (!state.childRows.length) {
      el.childTableHead.innerHTML = "";
      el.childTableBody.innerHTML = `
        <tr><td class="placeholder">子一覧はありません。</td></tr>
      `;
      return;
    }

    const columns = getChildColumns(state.sourceType);

    el.childTableHead.innerHTML = `
      <tr>
        ${columns.map(col => `<th style="${col.width ? `width:${col.width};` : ""}">${escapeHtml(col.label)}</th>`).join("")}
      </tr>
    `;

    el.childTableBody.innerHTML = state.childRows.map((row) => {
      const rowKey = getChildRowKey(state.sourceType, row);
      const selectedClass = state.selectedChildKey === rowKey ? "is-selected" : "is-clickable";

      return `
        <tr class="${selectedClass}" data-child-key="${escapeHtml(rowKey)}">
          ${columns.map(col => {
            const value = col.render ? col.render(row) : row[col.key];
            return `<td>${value == null ? "" : value}</td>`;
          }).join("")}
        </tr>
      `;
    }).join("");

    el.childTableBody.querySelectorAll("tr[data-child-key]").forEach((tr) => {
      tr.addEventListener("click", async () => {
        const rowKey = tr.dataset.childKey;
        const row = state.childRows.find(x => getChildRowKey(state.sourceType, x) === rowKey);
        if (!row) return;

        state.selectedChildKey = rowKey;
        renderChildTable();

        if (state.sourceType === "public_url") {
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
    el.detailCard.textContent = text || "";
  }

  function updateSummaries() {
    el.summaryText.textContent = `${state.parentRows.length} 件`;
    el.selectionSummary.textContent = `選択 ${state.checkedParents.size} 件`;

    const contextMap = {
      kokkai: "親一覧: 院 + 会議名",
      opendata: "親一覧: データセット",
      public_url: "親一覧: ルートURL",
      upload: "親一覧: アップロードファイル"
    };
    el.contextSummary.textContent = contextMap[state.sourceType] || "親一覧";
  }

  function updateKnowledgeButton() {
    el.btnKnowledge.disabled = state.checkedParents.size === 0;
  }

  function handleKnowledge() {
    const selected = state.parentRows.filter((row) => {
      const key = getParentRowKey(state.sourceType, row);
      return state.checkedParents.has(key);
    });

    if (!selected.length) {
      alert("親一覧から対象を選択してください。");
      return;
    }

    const payload = {
      source_type: state.sourceType,
      selected_parents: selected,
      created_at: new Date().toISOString()
    };

    sessionStorage.setItem("knowledge_targets", JSON.stringify(payload));
    alert("選択対象を保存しました。次のナレッジ化処理画面で利用してください。");
    location.href = NEXT_KNOWLEDGE_PAGE;
  }

  function getParentColumns(sourceType) {
    if (sourceType === "kokkai") {
      return [
        { type: "checkbox", label: "" , width: "52px" },
        { key: "name_of_house", label: "院", width: "120px" },
        { key: "name_of_meeting", label: "会議名" },
        { key: "row_count", label: "件数", width: "90px" },
        { key: "status", label: "状態", width: "100px", render: (row) => renderStatus(row.status) }
      ];
    }

    if (sourceType === "opendata") {
      return [
        { type: "checkbox", label: "" , width: "52px" },
        { key: "logical_name", label: "タイトル" },
        { key: "ext", label: "ext", width: "90px" },
        { key: "row_count", label: "件数", width: "90px" },
        { key: "status", label: "状態", width: "100px", render: (row) => renderStatus(row.status) }
      ];
    }

    if (sourceType === "public_url") {
      return [
        { type: "checkbox", label: "" , width: "52px" },
        { key: "root_url", label: "ルートURL" },
        { key: "source_type", label: "種別", width: "120px" },
        { key: "created_at", label: "作成日", width: "130px", render: (row) => escapeHtml(toDate(row.created_at)) }
      ];
    }

    return [
      { type: "checkbox", label: "" , width: "52px" },
      { key: "logical_name", label: "ファイル名" },
      { key: "ext", label: "ext", width: "90px" },
      { key: "created_at", label: "作成日", width: "130px", render: (row) => escapeHtml(toDate(row.created_at)) }
    ];
  }

  function getChildColumns(sourceType) {
    if (sourceType === "kokkai") {
      return [
        { key: "row_index", label: "No", width: "70px" },
        { key: "speaker", label: "発言者", width: "140px", render: (row) => escapeHtml(extractSpeaker(row)) },
        { key: "speech", label: "内容", render: (row) => escapeHtml(shorten(extractSpeech(row), 120)) }
      ];
    }

    if (sourceType === "opendata") {
      return [
        { key: "row_index", label: "No", width: "70px" },
        { key: "content", label: "概要", render: (row) => escapeHtml(shorten(extractContentText(row), 120)) }
      ];
    }

    if (sourceType === "public_url") {
      return [
        { key: "depth", label: "階層", width: "70px" },
        { key: "page_type", label: "種別", width: "90px", render: (row) => escapeHtml(row.page_type || "") },
        { key: "score", label: "評価", width: "80px" },
        { key: "status", label: "状態", width: "100px", render: (row) => renderStatus(row.status) },
        { key: "page_url", label: "ページURL", render: (row) => renderLink(row.page_url) }
      ];
    }

    return [
      { key: "row_index", label: "No", width: "70px" },
      { key: "content", label: "概要", render: (row) => escapeHtml(shorten(extractContentText(row), 120)) }
    ];
  }

  function getParentRowKey(sourceType, row) {
    if (sourceType === "kokkai") {
      return `${row.name_of_house}__${row.name_of_meeting}`;
    }
    if (sourceType === "opendata") {
      return String(row.source_id);
    }
    if (sourceType === "public_url") {
      return String(row.root_id);
    }
    return String(row.file_id);
  }

  function getChildRowKey(sourceType, row) {
    if (sourceType === "public_url") {
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
    return `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v)}</a>`;
  }

  function extractSpeaker(row) {
    const content = parseContent(row && row.content);
    return content && (content.speaker || content.speakerName || content.nameOfSpeaker) || "";
  }

  function extractSpeech(row) {
    const content = parseContent(row && row.content);
    return content && (content.speech || content.speechText || content.body) || extractContentText(row);
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
