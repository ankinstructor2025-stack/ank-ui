console.log("data_view.js loaded");

const btnKnowledge = document.getElementById("btnKnowledge");
const btnParentCheckAll = document.getElementById("btnParentCheckAll");
const btnParentClearAll = document.getElementById("btnParentClearAll");

const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const parentTableHead = document.getElementById("parentTableHead");
const parentTableBody = document.getElementById("parentTableBody");
const childTableHead = document.getElementById("childTableHead");
const childTableBody = document.getElementById("childTableBody");

const parentPager = document.getElementById("parentPager");
const childPager = document.getElementById("childPager");

const detailPre = document.getElementById("detailPre");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

const PARENT_PAGE_SIZE = 5;
const CHILD_PAGE_SIZE = 5;

let sourceList = [];
let sourceMap = {};
let currentSourceKey = "";
let knowledgeRunning = false;

let parentPage = 1;
let childPage = 1;

function getSourceSelect() {
  return document.getElementById("sourceSelect");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFirebaseAuth() {
  try {
    if (window.firebase && typeof window.firebase.auth === "function") {
      return window.firebase.auth();
    }
  } catch (_) {}
  return null;
}

async function getIdToken(forceRefresh = false) {
  const auth = getFirebaseAuth();

  if (auth && auth.currentUser) {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    if (token) {
      sessionStorage.setItem("idToken", token);
      return token;
    }
  }

  const cached = sessionStorage.getItem("idToken");
  if (cached) {
    return cached;
  }

  throw new Error("ログイン情報が見つかりません");
}

async function requireIdToken(forceRefresh = false) {
  const idToken = await getIdToken(forceRefresh);
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

async function readErrorDetail(res) {
  let detail = `APIエラー (HTTP ${res.status})`;

  try {
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.detail) {
        detail = data.detail;
      }
    } else {
      const text = await res.text();
      if (text) {
        detail = text;
      }
    }
  } catch (_) {}

  return detail;
}

async function fetchWithAuth(path, options = {}, query = {}, retry401 = true) {
  const url = buildApiUrl(path, query);
  const idToken = await requireIdToken(false);

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${idToken}`
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401 && retry401) {
    const refreshedToken = await requireIdToken(true);
    const retryHeaders = {
      ...(options.headers || {}),
      Authorization: `Bearer ${refreshedToken}`
    };

    return await fetch(url, {
      ...options,
      headers: retryHeaders
    });
  }

  return res;
}

async function apiGet(path, query = {}) {
  const res = await fetchWithAuth(
    path,
    { method: "GET" },
    query,
    true
  );

  if (!res.ok) {
    throw new Error(await readErrorDetail(res));
  }

  return await res.json();
}

async function apiPost(path, body = null, query = {}) {
  const headers = {};
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetchWithAuth(
    path,
    {
      method: "POST",
      headers,
      body: body !== null ? JSON.stringify(body) : undefined
    },
    query,
    true
  );

  if (!res.ok) {
    throw new Error(await readErrorDetail(res));
  }

  return await res.json();
}

async function apiGetForCurrentView(path, query = {}) {
  const data = await apiGet(path, query);

  if (currentSourceKey === "api_datago" && path === "/opendata/documents") {
    const allRows = Array.isArray(data?.datasets) ? data.datasets : [];
    const doneRows = allRows.filter((row) => String(row?.status || "").toLowerCase() === "done");

    return {
      ...data,
      datasets: doneRows,
      all_count: allRows.length,
      done_count: doneRows.length
    };
  }

  return data;
}

function setKnowledgeBusy(isBusy) {
  knowledgeRunning = isBusy;

  if (btnKnowledge) {
    btnKnowledge.disabled = isBusy;
    btnKnowledge.textContent = isBusy ? "ナレッジ化 実行中..." : "選択対象をナレッジ化";
  }

  const sourceSelect = getSourceSelect();
  if (sourceSelect) {
    sourceSelect.disabled = isBusy;
  }
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "done") return "url-chip status-done";
  if (s === "error") return "url-chip status-error";
  return "url-chip status-new";
}

function getJobPathBySourceType(sourceType) {
  return "/knowledge/job";
}

function getRunPathBySourceType(sourceType) {
  return "/knowledge/run";
}

function buildKnowledgeJobPayload(source, checkedRows) {
  const sourceType = String(source?.sourceType || "");
  const sourceKey = String(source?.key || "");
  const rows = Array.isArray(checkedRows) ? checkedRows : [];

  if (!sourceType) {
    throw new Error("source_type を判定できません");
  }

  if (rows.length === 0) {
    throw new Error("対象を選択してください");
  }

  if (sourceType === "kokkai") {
    return {
      source_type: "kokkai",
      source_name: "国会議事録",
      request_type: "extract_knowledge",
      preview_only: false,
      items: rows.map((row) => ({
        source_type: "kokkai",
        parent_source_id: row.issue_id ?? row.source_id ?? null,
        parent_key1: row.name_of_house ?? null,
        parent_key2: row.name_of_meeting ?? null,
        parent_label: row.logical_name || `${row.name_of_house ?? ""} / ${row.name_of_meeting ?? ""}`,
        row_count: Number(row.row_count ?? row.child_count ?? 0)
      }))
    };
  }

  if (sourceType === "opendata") {
    return {
      source_type: "opendata",
      source_name: "オープンデータ",
      request_type: "extract_knowledge",
      preview_only: false,
      items: rows.map((row) => ({
        source_type: "opendata",
        parent_source_id: row.source_id ?? null,
        parent_key1: row.dataset_id ?? null,
        parent_key2: row.title ?? row.logical_name ?? null,
        parent_label: row.title || row.logical_name || row.source_id || "",
        row_count: Number(row.child_count ?? row.row_count ?? 0)
      }))
    };
  }

  if (sourceType === "public_url") {
    return {
      source_type: "public_url",
      source_name: "公開URL",
      request_type: "extract_knowledge",
      preview_only: false,
      items: rows.map((row) => ({
        source_type: "public_url",
        parent_source_id: row.root_id ?? row.source_id ?? row.page_id ?? null,
        parent_key1: row.root_url ?? row.page_url ?? null,
        parent_key2: row.title ?? null,
        parent_label: row.title || row.root_url || row.page_url || row.source_id || "",
        row_count: Number(row.child_count ?? row.row_count ?? 0)
      }))
    };
  }

  if (sourceType === "upload") {
    return {
      source_type: "upload",
      source_name: "ファイルアップロード",
      request_type: "extract_knowledge",
      preview_only: false,
      items: rows.map((row) => ({
        source_type: "upload",
        parent_source_id: row.file_id ?? row.source_id ?? null,
        parent_key1: row.logical_name ?? row.file_name ?? row.original_name ?? null,
        parent_key2: row.ext ?? null,
        parent_label: row.logical_name || row.file_name || row.original_name || row.file_id || "",
        row_count: Number(row.row_count ?? row.child_count ?? 0)
      }))
    };
  }

  return {
    source_type: sourceType,
    source_key: sourceKey,
    items: rows
  };
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

function getBodyRows(tbody) {
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll("tr"));
}

function isPlaceholderOnly(rows) {
  if (!rows || rows.length === 0) return true;
  if (rows.length !== 1) return false;
  return rows[0].classList.contains("placeholder-row");
}

function applyRowPaging(tbody, pagerEl, page, pageSize) {
  const rows = getBodyRows(tbody);

  if (rows.length === 0 || isPlaceholderOnly(rows)) {
    if (pagerEl) {
      pagerEl.innerHTML = "";
      pagerEl.classList.add("hidden");
    }
    return {
      page: 1,
      totalPages: 1
    };
  }

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  rows.forEach((row, index) => {
    row.style.display = index >= start && index < end ? "" : "none";
  });

  return {
    page: safePage,
    totalPages
  };
}

function renderPager(pagerEl, currentPage, totalPages, onMove) {
  if (!pagerEl) return;

  if (totalPages <= 1) {
    pagerEl.innerHTML = "";
    pagerEl.classList.add("hidden");
    return;
  }

  pagerEl.classList.remove("hidden");
  pagerEl.innerHTML = `
    <button type="button" class="btn" data-move="first" ${currentPage <= 1 ? "disabled" : ""}>先頭</button>
    <button type="button" class="btn" data-move="prev" ${currentPage <= 1 ? "disabled" : ""}>前へ</button>
    <span class="placeholder">${currentPage} / ${totalPages}</span>
    <button type="button" class="btn" data-move="next" ${currentPage >= totalPages ? "disabled" : ""}>次へ</button>
    <button type="button" class="btn" data-move="last" ${currentPage >= totalPages ? "disabled" : ""}>末尾</button>
  `;

  pagerEl.querySelectorAll("button[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const move = btn.dataset.move;
      let nextPage = currentPage;

      if (move === "first") nextPage = 1;
      if (move === "prev") nextPage = currentPage - 1;
      if (move === "next") nextPage = currentPage + 1;
      if (move === "last") nextPage = totalPages;

      onMove(nextPage);
    });
  });
}

function refreshParentPaging() {
  const result = applyRowPaging(parentTableBody, parentPager, parentPage, PARENT_PAGE_SIZE);
  parentPage = result.page;

  renderPager(parentPager, result.page, result.totalPages, (nextPage) => {
    parentPage = nextPage;
    refreshParentPaging();
  });
}

function refreshChildPaging() {
  const result = applyRowPaging(childTableBody, childPager, childPage, CHILD_PAGE_SIZE);
  childPage = result.page;

  renderPager(childPager, result.page, result.totalPages, (nextPage) => {
    childPage = nextPage;
    refreshChildPaging();
  });
}

function resetPaging() {
  parentPage = 1;
  childPage = 1;
  refreshParentPaging();
  refreshChildPaging();
}

function renderInitialScreen() {
  renderParentPlaceholder("データ種別を選択してください。");
  renderChildPlaceholder("親一覧から1件選択してください。");

  if (detailPre) detailPre.textContent = "データ種別を選択してください。";
  if (selectionSummary) selectionSummary.textContent = "選択 0 件";
  if (contextSummary) contextSummary.textContent = "親一覧";
  if (btnKnowledge) btnKnowledge.disabled = true;

  resetPaging();
}

function resetViewForSource() {
  renderParentPlaceholder("読み込み中です...");
  renderChildPlaceholder("親一覧から1件選択してください。");

  if (detailPre) detailPre.textContent = "読み込み中です...";
  if (selectionSummary) selectionSummary.textContent = "選択 0 件";
  if (contextSummary) contextSummary.textContent = "親一覧";
  if (btnKnowledge) btnKnowledge.disabled = true;

  resetPaging();
}

function getCurrentModule() {
  const source = sourceMap[currentSourceKey];
  if (!source) return null;

  if (source.key === "api_kokkai") return window.DataViewKokkai || null;
  if (source.key === "api_datago") return window.DataViewOpenData || null;
  if (source.sourceType === "public_url") return window.DataViewPublicUrl || null;
  if (source.key === "file_upload") return window.DataViewUpload || null;

  return null;
}

function createViewContext() {
  return {
    apiBase: API_BASE,
    currentSourceKey,
    sourceMap,
    sourceSelect: getSourceSelect(),
    btnKnowledge,
    selectionSummary,
    selectedCountEl: selectionSummary,
    contextSummary,
    parentTableHead,
    parentTableBody,
    childTableHead,
    childTableBody,
    detailPre,
    apiGet: apiGetForCurrentView,
    apiPost,
    escapeHtml,
    getStatusClass,
    renderParentPlaceholder,
    renderChildPlaceholder,
    btnCheckAll: btnParentCheckAll,
    btnClearChecks: btnParentClearAll,
    refreshParentPager: refreshParentPaging,
    refreshChildPager: refreshChildPaging
  };
}

function initModuleIfNeeded(module, ctx) {
  if (!module || typeof module.init !== "function") return;

  try {
    module.init(ctx);
  } catch (e) {
    console.warn("module.init failed", e);
  }
}

async function loadModuleData(module, ctx) {
  if (!module) {
    throw new Error("照会モジュールが見つかりません");
  }

  if (typeof module.load === "function") {
    await module.load(ctx);
    return;
  }

  initModuleIfNeeded(module, ctx);

  if (typeof module.loadParents === "function") {
    await module.loadParents();
    return;
  }

  throw new Error("このデータ種別の照会処理は未実装です。");
}

function decorateOpenDataButtons() {
  if (currentSourceKey !== "api_datago" || !parentTableBody) {
    return;
  }

  const buttons = parentTableBody.querySelectorAll(".btn-download");
  buttons.forEach((btn) => {
    btn.classList.add("btn", "btn-primary");
  });

  const childButtons = childTableBody?.querySelectorAll(".btn-download-child") || [];
  childButtons.forEach((btn) => {
    btn.classList.add("btn", "btn-primary");
  });
}

function updateOpenDataSummary() {
  if (currentSourceKey !== "api_datago") return;

  if (contextSummary) {
    contextSummary.textContent = "親一覧: 取得済ファイルのみ表示";
  }
}

async function refreshParentList() {
  if (!currentSourceKey) {
    renderInitialScreen();
    return;
  }

  const module = getCurrentModule();
  const source = sourceMap[currentSourceKey];
  const ctx = createViewContext();

  if (!module) {
    renderParentPlaceholder("このデータ種別の照会処理は未実装です。");
    renderChildPlaceholder("親一覧から1件選択してください。");
    if (detailPre) detailPre.textContent = `選択中: ${source?.label || ""}`;
    if (contextSummary) contextSummary.textContent = `親一覧: ${source?.label || ""}`;
    resetPaging();
    return;
  }

  resetViewForSource();
  await loadModuleData(module, ctx);

  if (currentSourceKey === "api_datago") {
    decorateOpenDataButtons();
    updateOpenDataSummary();
  }

  if (btnKnowledge) {
    btnKnowledge.disabled = false;
  }

  resetPaging();
}

function buildKnowledgeResultText(data) {
  const lines = [
    `job_id: ${data?.job_id ?? ""}`,
    `status: ${data?.status ?? ""}`,
    `selected_count: ${data?.selected_count ?? 0}`,
    `created_item_count: ${data?.created_item_count ?? 0}`,
    ""
  ];

  const debugItems = Array.isArray(data?.debug_items) ? data.debug_items : [];
  if (debugItems.length > 0) {
    lines.push("debug_items:");
    debugItems.forEach((item, idx) => {
      lines.push(`- [${idx + 1}] ${item?.parent_label || ""}`);
      lines.push(`  status: ${item?.status || ""}`);
      lines.push(`  qa_count: ${item?.qa_count || 0}`);
      lines.push(`  plain_count: ${item?.plain_count || 0}`);
      lines.push(`  error_message: ${item?.error_message || ""}`);
    });
    lines.push("");
  }

  const previews = Array.isArray(data?.prompt_previews) ? data.prompt_previews : [];
  if (previews.length > 0) {
    lines.push("prompt_previews:");
    previews.forEach((item, idx) => {
      lines.push(`--- prompt ${idx + 1} ---`);
      lines.push(`対象: ${item?.parent_label || item?.parent_source_id || ""}`);
      lines.push(`job_item_id: ${item?.job_item_id || ""}`);
      lines.push("");
      lines.push(item?.prompt_text || "");
      lines.push("");
    });
  }

  return lines.join("\n").trim();
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

  const source = sourceMap[currentSourceKey];
  if (!source?.sourceType) {
    alert("source_type を判定できません");
    return;
  }

  setKnowledgeBusy(true);

  try {
    const jobPath = getJobPathBySourceType(source.sourceType);
    if (!jobPath) {
      throw new Error(`job path が不正です: ${source.sourceType}`);
    }

    const runPath = getRunPathBySourceType(source.sourceType);
    if (!runPath) {
      throw new Error(`run path が不正です: ${source.sourceType}`);
    }

    const payload = buildKnowledgeJobPayload(source, checkedRows);
    const jobData = await apiPost(jobPath, payload);

    const jobId = String(jobData?.job_id || "");
    if (!jobId) {
      throw new Error("job_id が取得できませんでした");
    }

    await apiPost(runPath, { job_id: jobId });

    if (detailPre) {
      detailPre.textContent =
        `ジョブを作成して実行を開始しました。\n\n${buildKnowledgeResultText(jobData || {})}`;
    }

    if (contextSummary) {
      contextSummary.textContent = "ナレッジ化: Cloud Tasks に投入しました";
    }

    if (selectionSummary) {
      selectionSummary.textContent = `選択 ${checkedRows.length} 件`;
    }

    alert("ナレッジ化を開始しました");
  } catch (e) {
    console.error(e);

    if (detailPre) {
      detailPre.textContent = e.message || "ナレッジ化処理でエラーが発生しました。";
    }

    if (contextSummary) {
      contextSummary.textContent = "ナレッジ化: 異常終了";
    }

    alert(e.message || "ナレッジ化処理でエラーが発生しました");
  } finally {
    setKnowledgeBusy(false);
  }
}

function bindEvents() {
  document.addEventListener("toolbar:ready", async (event) => {
    const detail = event.detail || {};
    const list = Array.isArray(detail.sourceList) ? detail.sourceList : [];
    sourceList = normalizeSourceMaster(list);
    sourceMap = {};

    sourceList.forEach((item) => {
      sourceMap[item.key] = item;
    });

    renderInitialScreen();
  });

  document.addEventListener("toolbar:source-change", async (event) => {
    try {
      const detail = event.detail || {};
      currentSourceKey = detail.sourceKey || "";
      await refreshParentList();
    } catch (e) {
      console.error(e);
      renderParentPlaceholder(e.message || "読込に失敗しました");
      renderChildPlaceholder("親一覧から1件選択してください。");
      if (detailPre) detailPre.textContent = e.message || "読込に失敗しました";
    }
  });

  btnKnowledge?.addEventListener("click", async () => {
    try {
      await createKnowledgeJob();
    } catch (e) {
      console.error(e);
      alert(e.message || "ナレッジ化に失敗しました");
    }
  });

  btnParentCheckAll?.addEventListener("click", () => {
    const module = getCurrentModule();
    if (module && typeof module.checkAll === "function") {
      module.checkAll();
      refreshParentPaging();
    }
  });

  btnParentClearAll?.addEventListener("click", () => {
    const module = getCurrentModule();
    if (module && typeof module.clearChecks === "function") {
      module.clearChecks();
      refreshParentPaging();
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  renderInitialScreen();
});
