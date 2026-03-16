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
let currentSourceKey = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const url = new URL(`${API_BASE}${normalizedPath}`);

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

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "done") return "status-pill status-done";
  if (s === "error") return "status-pill status-error";
  return "status-pill status-new";
}

function renderSourceOptions(list) {
  const groups = {};

  list.forEach((item) => {
    const groupName = item.group || "その他";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
  });

  const html = [`<option value="" selected disabled>選択してください</option>`];

  Object.keys(groups).forEach((groupName) => {
    html.push(`<optgroup label="${escapeHtml(groupName)}">`);

    groups[groupName].forEach((item) => {
      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label || item.key)}</option>`
      );
    });

    html.push(`</optgroup>`);
  });

  if (sourceSelect) {
    sourceSelect.innerHTML = html.join("");
  }
}

function mapKeyToSourceType(key, type) {
  if (key === "api_kokkai") return "kokkai";
  if (key === "api_datago") return "opendata";
  if (type === "public_url" || String(key || "").startsWith("url_")) return "public_url";
  if (key === "file_upload") return "upload";
  return "";
}

function normalizeSourceMaster(list) {
  if (!Array.isArray(list)) return [];

  return list.map((item) => ({
    key: item.key,
    label: item.label || item.name || item.key,
    group: item.group || "その他",
    type: item.type || "",
    sourceType: mapKeyToSourceType(item.key, item.type)
  }));
}

function updateSourceName() {
  const item = sourceMap[currentSourceKey];
  const text = item ? item.label : "";

  if (!sourceName) return;
  sourceName.value = text;
}

function renderParentPlaceholder(message) {
  if (parentTableHead) parentTableHead.innerHTML = "";
  if (parentTableBody) {
    parentTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>${escapeHtml(message)}</td>
      </tr>
    `;
  }
}

function renderChildPlaceholder(message) {
  if (childTableHead) childTableHead.innerHTML = "";
  if (childTableBody) {
    childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>${escapeHtml(message)}</td>
      </tr>
    `;
  }
}

function renderInitialScreen() {
  renderParentPlaceholder("データ種別を選択してください。");
  renderChildPlaceholder("親一覧から1件選択してください。");

  if (detailPre) detailPre.textContent = "データ種別を選択してください。";
  if (summaryText) summaryText.textContent = "0 件";
  if (selectionSummary) selectionSummary.textContent = "選択 0 件";
  if (contextSummary) contextSummary.textContent = "親一覧";
  if (btnKnowledge) btnKnowledge.disabled = true;
}

function resetViewForSource() {
  renderParentPlaceholder("読み込み中です...");
  renderChildPlaceholder("親一覧から1件選択してください。");

  if (detailPre) detailPre.textContent = "読み込み中です...";
  if (summaryText) summaryText.textContent = "0 件";
  if (selectionSummary) selectionSummary.textContent = "選択 0 件";
  if (contextSummary) contextSummary.textContent = "親一覧";
  if (btnKnowledge) btnKnowledge.disabled = true;
}

function getCurrentModule() {
  const source = sourceMap[currentSourceKey];
  if (!source) return null;

  if (source.key === "api_kokkai") {
    return window.DataViewKokkai || null;
  }

  if (source.key === "api_datago") {
    return window.DataViewOpenData || null;
  }

  if (source.sourceType === "public_url") {
    return window.DataViewPublicUrl || null;
  }

  if (source.key === "file_upload") {
    return window.DataViewUpload || null;
  }

  return null;
}

function createViewContext() {
  return {
    apiBase: API_BASE,
    currentSourceKey,
    sourceMap,
    sourceSelect,
    sourceName,
    btnKnowledge,
    summaryText,
    selectionSummary,
    contextSummary,
    parentTableHead,
    parentTableBody,
    childTableHead,
    childTableBody,
    detailPre,
    apiGet,
    escapeHtml,
    getStatusClass,
    renderParentPlaceholder,
    renderChildPlaceholder
  };
}

async function refreshParentList() {
  if (!currentSourceKey) {
    renderInitialScreen();
    return;
  }

  const module = getCurrentModule();
  const source = sourceMap[currentSourceKey];

  if (!module || typeof module.load !== "function") {
    renderParentPlaceholder("このデータ種別の照会処理は未実装です。");
    renderChildPlaceholder("親一覧から1件選択してください。");
    if (detailPre) detailPre.textContent = `選択中: ${source?.label || ""}`;
    if (contextSummary) contextSummary.textContent = `親一覧: ${source?.label || ""}`;
    return;
  }

  resetViewForSource();
  await module.load(createViewContext());
}

async function handleSourceChange() {
  currentSourceKey = sourceSelect ? sourceSelect.value : "";
  updateSourceName();
  await refreshParentList();
}

async function loadSourceMaster() {
  try {
    const res = await fetch("./source_master.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    sourceList = normalizeSourceMaster(json);
    sourceMap = {};

    sourceList.forEach((item) => {
      sourceMap[item.key] = item;
    });

    renderSourceOptions(sourceList);
    updateSourceName();
  } catch (e) {
    console.error(e);

    if (sourceSelect) {
      sourceSelect.innerHTML =
        `<option value="" selected disabled>データ種別読込失敗</option>`;
    }

    if (detailPre) {
      detailPre.textContent = `データ種別読込失敗: ${e.message}`;
    }
  }
}

function buildKnowledgeResultText(data) {
  const lines = [];

  lines.push(`job_id: ${data?.job_id ?? ""}`);
  lines.push(`status: ${data?.status ?? ""}`);
  lines.push(`selected_count: ${data?.selected_count ?? 0}`);
  lines.push(`created_item_count: ${data?.created_item_count ?? 0}`);
  lines.push("");

  const previews = Array.isArray(data?.prompt_previews) ? data.prompt_previews : [];
  if (previews.length > 0) {
    previews.forEach((item, index) => {
      lines.push(`--- prompt ${index + 1} ---`);
      lines.push(item?.prompt_text || "");
      lines.push("");
    });
  }

  const debugItems = Array.isArray(data?.debug_items) ? data.debug_items : [];
  if (debugItems.length > 0) {
    lines.push("=== debug_items ===");
    debugItems.forEach((item, index) => {
      lines.push(`--- debug ${index + 1} ---`);
      lines.push(`job_item_id: ${item?.job_item_id ?? ""}`);
      lines.push(`parent_label: ${item?.parent_label ?? ""}`);
      lines.push(`status: ${item?.status ?? ""}`);
      lines.push(`qa_count: ${item?.qa_count ?? 0}`);
      lines.push(`error_message: ${item?.error_message ?? ""}`);
      if (item?.llm_result !== undefined && item?.llm_result !== null) {
        lines.push("llm_result:");
        lines.push(JSON.stringify(item.llm_result, null, 2));
      }
      lines.push("");
    });
  }

  if (previews.length === 0 && debugItems.length === 0) {
    lines.push(JSON.stringify(data, null, 2));
  }

  return lines.join("\n");
}

async function createKnowledgeJob() {
  const module = getCurrentModule();
  if (!module || typeof module.getCheckedRows !== "function") {
    alert("対象取得に失敗しました");
    return;
  }

  const checkedRows = module.getCheckedRows();

  if (!checkedRows || checkedRows.length === 0) {
    alert("対象を選択してください");
    return;
  }

  const payload = {
    source_type: "kokkai",
    source_name: "国会議事録",
    request_type: "extract_knowledge",
    preview_only: false,
    items: checkedRows.map((row) => ({
      source_type: "kokkai",
      parent_source_id: row.source_id ?? null,
      parent_key1: row.name_of_house ?? null,
      parent_key2: row.name_of_meeting ?? null,
      parent_label: `${row.name_of_house ?? ""} / ${row.name_of_meeting ?? ""}`,
      row_count: row.row_count ?? 0
    }))
  };

  const idToken = requireIdToken();

  try {
    if (detailPre) {
      detailPre.textContent = "ナレッジ化を実行中です...";
    }

    const res = await fetch(`${API_BASE}/knowledge/kokkai/job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    });

    const rawText = await res.text();

    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      data = null;
    }

    if (!res.ok) {
      const errorText = data ? JSON.stringify(data, null, 2) : rawText;
      if (detailPre) {
        detailPre.textContent = errorText || `APIエラー (HTTP ${res.status})`;
      }
      alert("ナレッジ化ジョブ作成エラー");
      return;
    }

    if (detailPre) {
      detailPre.textContent = buildKnowledgeResultText(data || {});
    }

    const previews = Array.isArray(data?.prompt_previews) ? data.prompt_previews : [];

    if (contextSummary) {
      contextSummary.textContent = `ナレッジ化: ${data?.status ?? "unknown"}`;
    }

    if (selectionSummary) {
      selectionSummary.textContent = `選択 ${checkedRows.length} 件 / prompt ${previews.length} 件`;
    }
  } catch (e) {
    console.error(e);
    if (detailPre) {
      detailPre.textContent = e.message || "ナレッジ化処理でエラーが発生しました。";
    }
    alert("ナレッジ化処理でエラーが発生しました");
  }
}

function bindEvents() {
  if (sourceSelect) {
    sourceSelect.addEventListener("change", handleSourceChange);
  }

  if (btnReload) {
    btnReload.addEventListener("click", async () => {
      await refreshParentList();
    });
  }

  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      window.location.href = "./menu.html";
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      sessionStorage.removeItem("idToken");
      window.location.href = "./index.html";
    });
  }

  if (btnKnowledge) {
    btnKnowledge.addEventListener("click", createKnowledgeJob);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderInitialScreen();
  bindEvents();
  await loadSourceMaster();
});
