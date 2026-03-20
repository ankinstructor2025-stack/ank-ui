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

const DEFAULT_POLLING_CONFIG = {
  initial_interval_ms: 5000,
  normal_interval_ms: 10000,
  long_interval_ms: 15000,
  long_after_count: 6,
  very_long_after_count: 18,
  max_attempts: 120,
  max_error_count: 3
};

const ACTIVE_JOB_STORAGE_KEY = "ank_active_knowledge_job";

let sourceList = [];
let sourceMap = {};
let currentSourceKey = "";
let knowledgeRunning = false;
let pollingConfig = { ...DEFAULT_POLLING_CONFIG };

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
    console.warn("401 detected. retry with refreshed token:", path);

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
    {
      method: "GET"
    },
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setKnowledgeBusy(isBusy) {
  knowledgeRunning = isBusy;

  if (btnKnowledge) {
    btnKnowledge.disabled = isBusy;
    btnKnowledge.textContent = isBusy ? "ナレッジ化 実行中..." : "選択対象をナレッジ化";
  }

  if (btnReload) {
    btnReload.disabled = isBusy;
  }

  if (sourceSelect) {
    sourceSelect.disabled = isBusy;
  }
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "done") return "status-pill status-done";
  if (s === "error") return "status-pill status-error";
  return "status-pill status-new";
}

function getStatusPathBySourceType(sourceType) {
  if (sourceType === "kokkai") return "/knowledge/kokkai/status";
  if (sourceType === "opendata") return "/knowledge/opendata/status";
  if (sourceType === "upload") return "/knowledge/upload/status";
  return "";
}

function getRunPathBySourceType(sourceType) {
  if (sourceType === "kokkai") return "/knowledge/kokkai/run";
  if (sourceType === "opendata") return "/knowledge/opendata/run";
  if (sourceType === "upload") return "/knowledge/upload/run";
  return "";
}

function saveActiveKnowledgeJob(job) {
  try {
    sessionStorage.setItem(
      ACTIVE_JOB_STORAGE_KEY,
      JSON.stringify({
        job_id: job?.job_id || "",
        source_type: job?.source_type || "",
        source_key: job?.source_key || "",
        selected_count: Number(job?.selected_count) || 0,
        saved_at: new Date().toISOString()
      })
    );
  } catch (e) {
    console.warn("failed to save active job", e);
  }
}

function loadActiveKnowledgeJob() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || !data.job_id || !data.source_type) return null;
    return data;
  } catch (e) {
    console.warn("failed to load active job", e);
    return null;
  }
}

function clearActiveKnowledgeJob() {
  sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
}

async function validateStoredActiveJob(previousActiveJob) {
  if (!previousActiveJob || !previousActiveJob.job_id || !previousActiveJob.source_type) {
    return null;
  }

  const statusPath = getStatusPathBySourceType(previousActiveJob.source_type);
  if (!statusPath) {
    clearActiveKnowledgeJob();
    return null;
  }

  try {
    const statusData = await apiGet(statusPath, { job_id: previousActiveJob.job_id });
    const status = String(statusData?.status || "").toLowerCase();

    if (status === "done" || status === "error") {
      clearActiveKnowledgeJob();
      return null;
    }

    return {
      job_id: previousActiveJob.job_id,
      status
    };
  } catch (e) {
    const message = String(e?.message || "").toLowerCase();

    if (
      message.includes("not found") ||
      message.includes("knowledge_jobs not found") ||
      message.includes("ank.db not found") ||
      message.includes("http 404")
    ) {
      clearActiveKnowledgeJob();
      return null;
    }

    throw e;
  }
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
    btnReload,
    summaryText,
    parentCountEl: summaryText,
    selectionSummary,
    selectedCountEl: selectionSummary,
    contextSummary,
    parentTableHead,
    parentTableBody,
    childTableHead,
    childTableBody,
    detailPre,
    apiGet,
    apiPost,
    escapeHtml,
    getStatusClass,
    renderParentPlaceholder,
    renderChildPlaceholder,
    btnCheckAll: document.getElementById("btnCheckAll"),
    btnClearChecks: document.getElementById("btnClearChecks")
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
    return;
  }

  resetViewForSource();
  await loadModuleData(module, ctx);
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

function buildStatusResultText(data) {
  const totalChunks = Number(data?.total_chunks || 0);
  const processedChunks = Number(data?.processed_chunks || 0);
  const totalQaChunks = Number(data?.total_qa_chunks || 0);
  const processedQaChunks = Number(data?.processed_qa_chunks || 0);
  const totalPlainChunks = Number(data?.total_plain_chunks || 0);
  const processedPlainChunks = Number(data?.processed_plain_chunks || 0);

  const lines = [
    `job_id: ${data?.job_id ?? ""}`,
    `status: ${data?.status ?? ""}`,
    `selected_count: ${data?.selected_count ?? 0}`,
    `qa_count: ${data?.qa_count ?? 0}`,
    `plain_count: ${data?.plain_count ?? 0}`,
    `error_count: ${data?.error_count ?? 0}`,
    `chunks: ${processedChunks} / ${totalChunks}`,
    `qa_chunks: ${processedQaChunks} / ${totalQaChunks}`,
    `plain_chunks: ${processedPlainChunks} / ${totalPlainChunks}`,
    `requested_at: ${data?.requested_at ?? ""}`,
    `started_at: ${data?.started_at ?? ""}`,
    `finished_at: ${data?.finished_at ?? ""}`,
    `error_message: ${data?.error_message ?? ""}`,
    ""
  ];

  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length > 0) {
    lines.push("items:");
    items.forEach((item, idx) => {
      lines.push(`- [${idx + 1}] ${item?.parent_label || item?.parent_source_id || ""}`);
      lines.push(`  job_item_id: ${item?.job_item_id || ""}`);
      lines.push(`  status: ${item?.status || ""}`);
      lines.push(`  knowledge_count: ${item?.knowledge_count || 0}`);
      lines.push(`  row_count: ${item?.row_count || 0}`);
      lines.push(`  chunk: ${item?.chunk_done || 0} / ${item?.chunk_total || 0}`);
      lines.push(`  qa_chunk: ${item?.qa_chunk_done || 0} / ${item?.qa_chunk_total || 0}`);
      lines.push(`  plain_chunk: ${item?.plain_chunk_done || 0} / ${item?.plain_chunk_total || 0}`);
      lines.push(`  started_at: ${item?.started_at || ""}`);
      lines.push(`  finished_at: ${item?.finished_at || ""}`);
      lines.push(`  error_message: ${item?.error_message || ""}`);
    });
  }

  return lines.join("\n").trim();
}

function isTerminalJobStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "done" || s === "error";
}

function getPollingIntervalMs(attempt) {
  if (attempt > pollingConfig.very_long_after_count) {
    return pollingConfig.long_interval_ms;
  }
  if (attempt > pollingConfig.long_after_count) {
    return pollingConfig.normal_interval_ms;
  }
  return pollingConfig.initial_interval_ms;
}

function summarizeJobItems(items) {
  const normalized = Array.isArray(items) ? items : [];

  const total = normalized.length;
  const doneCountOnly = normalized.filter((x) => String(x?.status || "").toLowerCase() === "done").length;
  const errorCount = normalized.filter((x) => String(x?.status || "").toLowerCase() === "error").length;
  const runningCount = normalized.filter((x) => {
    const s = String(x?.status || "").toLowerCase();
    return s === "running" || s === "processing";
  }).length;
  const queuedCount = normalized.filter((x) => {
    const s = String(x?.status || "").toLowerCase();
    return s === "new" || s === "queued" || s === "pending" || s === "";
  }).length;

  const doneCount = doneCountOnly + errorCount;
  const remaining = Math.max(0, total - doneCount);

  return {
    total,
    doneCountOnly,
    errorCount,
    runningCount,
    queuedCount,
    doneCount,
    remaining
  };
}

function updatePollingSummary(data, attempt, maxAttempts) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const summary = summarizeJobItems(items);
  const totalForDisplay = summary.total || Number(data?.selected_count) || 0;

  const totalChunks = Number(data?.total_chunks || 0);
  const processedChunks = Number(data?.processed_chunks || 0);
  const totalQaChunks = Number(data?.total_qa_chunks || 0);
  const processedQaChunks = Number(data?.processed_qa_chunks || 0);
  const totalPlainChunks = Number(data?.total_plain_chunks || 0);
  const processedPlainChunks = Number(data?.processed_plain_chunks || 0);

  if (contextSummary) {
    contextSummary.textContent =
      `ナレッジ化: CHUNK ${processedChunks} / ${totalChunks}` +
      `（QA ${processedQaChunks} / ${totalQaChunks}｜PLAIN ${processedPlainChunks} / ${totalPlainChunks}｜status: ${data?.status ?? "unknown"}）`;
  }

  if (selectionSummary) {
    selectionSummary.textContent =
      `親 ${summary.doneCount} / ${totalForDisplay}` +
      `（done ${summary.doneCountOnly}｜error ${summary.errorCount}｜実行中 ${summary.runningCount}｜待機 ${summary.queuedCount}）`;
  }
}

async function pollKnowledgeJobStatus(statusPath, jobId) {
  const maxAttempts = pollingConfig.max_attempts || DEFAULT_POLLING_CONFIG.max_attempts;
  const maxErrorCount = pollingConfig.max_error_count || DEFAULT_POLLING_CONFIG.max_error_count;

  let lastData = null;
  let lastError = null;
  let consecutiveErrorCount = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const data = await apiGet(statusPath, { job_id: jobId });
      lastData = data;
      lastError = null;
      consecutiveErrorCount = 0;

      if (detailPre) {
        detailPre.textContent = buildStatusResultText(data);
      }

      updatePollingSummary(data, attempt, maxAttempts);

      if (isTerminalJobStatus(data?.status)) {
        return data;
      }
    } catch (e) {
      lastError = e;
      consecutiveErrorCount += 1;
      console.error(`poll failed [${attempt}/${maxAttempts}]`, e);

      if (detailPre) {
        detailPre.textContent =
          `ステータス確認でエラーが発生しました。\n` +
          `attempt: ${attempt} / ${maxAttempts}\n` +
          `error_count: ${consecutiveErrorCount} / ${maxErrorCount}\n` +
          `message: ${e?.message || e}`;
      }

      if (contextSummary) {
        contextSummary.textContent =
          `ナレッジ化: status取得失敗（確認 ${attempt} / ${maxAttempts}）`;
      }

      if (consecutiveErrorCount >= maxErrorCount) {
        throw new Error(`ステータス確認が連続失敗しました: ${e?.message || e}`);
      }
    }

    if (attempt < maxAttempts) {
      await sleep(getPollingIntervalMs(attempt));
    }
  }

  if (lastData) {
    throw new Error(
      `ステータス確認が上限回数に達しました。last_status=${lastData?.status || "unknown"}`
    );
  }

  throw lastError || new Error("ステータス確認に失敗しました");
}

async function runKnowledgeJobAndPoll(sourceType, jobId) {
  const runPath = getRunPathBySourceType(sourceType);
  const statusPath = getStatusPathBySourceType(sourceType);

  if (!runPath || !statusPath) {
    throw new Error(`未対応の sourceType です: ${sourceType}`);
  }

  await apiPost(runPath, { job_id: jobId });
  return await pollKnowledgeJobStatus(statusPath, jobId);
}

async function finalizeKnowledgePolling(statusData, checkedRowsLength = 0) {
  if (detailPre) {
    detailPre.textContent = buildStatusResultText(statusData || {});
  }

  if (contextSummary) {
    const totalChunks = Number(statusData?.total_chunks || 0);
    const processedChunks = Number(statusData?.processed_chunks || 0);
    const totalQaChunks = Number(statusData?.total_qa_chunks || 0);
    const processedQaChunks = Number(statusData?.processed_qa_chunks || 0);
    const totalPlainChunks = Number(statusData?.total_plain_chunks || 0);
    const processedPlainChunks = Number(statusData?.processed_plain_chunks || 0);

    contextSummary.textContent =
      `ナレッジ化: CHUNK ${processedChunks} / ${totalChunks}` +
      `（QA ${processedQaChunks} / ${totalQaChunks}｜PLAIN ${processedPlainChunks} / ${totalPlainChunks}｜status: ${statusData?.status ?? "unknown"}）`;
  }

  if (selectionSummary) {
    const items = Array.isArray(statusData?.items) ? statusData.items : [];
    const summary = summarizeJobItems(items);
    const totalForDisplay = summary.total || Number(statusData?.selected_count) || checkedRowsLength;

    selectionSummary.textContent =
      `親 ${summary.doneCount} / ${totalForDisplay}` +
      `（done ${summary.doneCountOnly}｜error ${summary.errorCount}｜実行中 ${summary.runningCount}｜待機 ${summary.queuedCount}）`;
  }

  if (statusData && String(statusData.status || "").toLowerCase() === "done") {
    alert("ナレッジ化が完了しました");
  } else if (statusData && String(statusData.status || "").toLowerCase() === "error") {
    alert("ナレッジ化でエラーが発生しました");
  } else {
    alert("ナレッジ化は完了判定できませんでした。詳細を確認してください。");
  }

  clearActiveKnowledgeJob();
  await refreshParentList();
}

function buildKnowledgeEndpointAndPayload(source, checkedRows) {
  if (!source || !source.sourceType) {
    throw new Error("sourceType が判定できません");
  }

  if (source.sourceType === "kokkai") {
    return {
      endpoint: "/knowledge/kokkai/job",
      payload: {
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
      }
    };
  }

  if (source.sourceType === "opendata") {
    return {
      endpoint: "/knowledge/opendata/job",
      payload: {
        source_type: "opendata",
        source_name: "オープンデータ",
        request_type: "extract_knowledge",
        preview_only: false,
        items: checkedRows.map((row) => ({
          source_type: "opendata",
          parent_source_id: row.source_id ?? null,
          parent_key1: row.dataset_id ?? null,
          parent_key2: row.ext ?? null,
          parent_label: row.title || row.dataset_id || row.source_id || "",
          row_count: row.row_count ?? 0
        }))
      }
    };
  }

  if (source.sourceType === "upload") {
    return {
      endpoint: "/knowledge/upload/job",
      payload: {
        source_type: "upload",
        source_name: "ファイルアップロード",
        request_type: "extract_knowledge",
        preview_only: false,
        items: checkedRows.map((row) => ({
          source_type: "upload",
          parent_source_id: row.file_id ?? null,
          parent_key1: row.logical_name ?? null,
          parent_key2: row.ext ?? null,
          parent_label: row.logical_name || row.original_name || row.file_id || "",
          row_count: row.row_count ?? 0
        }))
      }
    };
  }

  throw new Error("このデータ種別のナレッジ化は未対応です");
}

async function resolveCheckedRows(module) {
  if (!module) {
    return [];
  }

  if (typeof module.getCheckedRows === "function") {
    const rows = module.getCheckedRows();
    return Array.isArray(rows) ? rows : [];
  }

  if (typeof module.buildKnowledgeTargets === "function") {
    const rows = await module.buildKnowledgeTargets();
    return Array.isArray(rows) ? rows : [];
  }

  return [];
}

async function createKnowledgeJob() {
  if (knowledgeRunning) {
    return;
  }

  const module = getCurrentModule();
  const checkedRows = await resolveCheckedRows(module);

  if (!checkedRows || checkedRows.length === 0) {
    alert("対象を選択してください");
    return;
  }

  const source = sourceMap[currentSourceKey];
  let endpoint = "";
  let payload = null;

  try {
    const built = buildKnowledgeEndpointAndPayload(source, checkedRows);
    endpoint = built.endpoint;
    payload = built.payload;
  } catch (e) {
    alert(e.message || "ナレッジ化の設定に失敗しました");
    return;
  }

  try {
    setKnowledgeBusy(true);

    if (detailPre) {
      detailPre.textContent = "ナレッジ化ジョブを作成中です...";
    }

    const previousActiveJob = loadActiveKnowledgeJob();
    const liveActiveJob = await validateStoredActiveJob(previousActiveJob);

    if (liveActiveJob && liveActiveJob.job_id) {
      alert(
        `別のジョブが実行中です。完了後に再実行してください。\n` +
        `job_id=${liveActiveJob.job_id}\n` +
        `status=${liveActiveJob.status}`
      );
      return;
    }

    const jobData = await apiPost(endpoint, payload);
    const jobId = jobData?.job_id;

    if (!jobId) {
      throw new Error("job_id が取得できませんでした");
    }

    saveActiveKnowledgeJob({
      job_id: jobId,
      source_type: source.sourceType,
      source_key: currentSourceKey,
      selected_count: checkedRows.length
    });

    if (detailPre) {
      detailPre.textContent =
        `ジョブを作成しました。\n\n${buildKnowledgeResultText(jobData || {})}\n\nバックグラウンド実行を開始します...`;
    }

    if (contextSummary) {
      contextSummary.textContent =
        `ナレッジ化: CHUNK 0 / 0（QA 0 / 0｜PLAIN 0 / 0｜status: ${jobData?.status ?? "new"}）`;
    }

    if (selectionSummary) {
      selectionSummary.textContent =
        `親 0 / ${checkedRows.length}（done 0｜error 0｜実行中 0｜待機 ${checkedRows.length}）`;
    }

    const statusData = await runKnowledgeJobAndPoll(source.sourceType, jobId);
    await finalizeKnowledgePolling(statusData, checkedRows.length);
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
  sourceSelect?.addEventListener("change", async () => {
    try {
      currentSourceKey = sourceSelect?.value || "";
      updateSourceName();
      await refreshParentList();
    } catch (e) {
      console.error(e);
      renderParentPlaceholder(e.message || "読込に失敗しました");
      renderChildPlaceholder("親一覧から1件選択してください。");
      if (detailPre) detailPre.textContent = e.message || "読込に失敗しました";
    }
  });

  btnReload?.addEventListener("click", async () => {
    try {
      await refreshParentList();
    } catch (e) {
      console.error(e);
      renderParentPlaceholder(e.message || "再読込に失敗しました");
      renderChildPlaceholder("親一覧から1件選択してください。");
      if (detailPre) detailPre.textContent = e.message || "再読込に失敗しました";
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

  btnMenu?.addEventListener("click", () => {
    window.location.href = "./menu.html";
  });

  btnLogout?.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    window.location.href = "./index.html";
  });
}

async function loadSourceMaster() {
  const res = await fetch("./source_master.json", {
    method: "GET",
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("source_master.json の取得に失敗しました");
  }

  const list = await res.json();

  sourceList = normalizeSourceMaster(Array.isArray(list) ? list : []);
  sourceMap = {};

  sourceList.forEach((item) => {
    sourceMap[item.key] = item;
  });

  renderSourceOptions(sourceList);
}

async function loadPollingConfig() {
  try {
    const res = await fetch("./polling_config.json", {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      pollingConfig = { ...DEFAULT_POLLING_CONFIG };
      return;
    }

    const data = await res.json();
    pollingConfig = {
      initial_interval_ms: Number(data?.initial_interval_ms) || DEFAULT_POLLING_CONFIG.initial_interval_ms,
      normal_interval_ms: Number(data?.normal_interval_ms) || DEFAULT_POLLING_CONFIG.normal_interval_ms,
      long_interval_ms: Number(data?.long_interval_ms) || DEFAULT_POLLING_CONFIG.long_interval_ms,
      long_after_count: Number(data?.long_after_count) || DEFAULT_POLLING_CONFIG.long_after_count,
      very_long_after_count: Number(data?.very_long_after_count) || DEFAULT_POLLING_CONFIG.very_long_after_count,
      max_attempts: Number(data?.max_attempts) || DEFAULT_POLLING_CONFIG.max_attempts,
      max_error_count: Number(data?.max_error_count) || DEFAULT_POLLING_CONFIG.max_error_count
    };

    console.log("polling_config loaded", pollingConfig);
  } catch (e) {
    console.warn("polling_config load failed", e);
    pollingConfig = { ...DEFAULT_POLLING_CONFIG };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  renderInitialScreen();

  try {
    await loadPollingConfig();
    await loadSourceMaster();
  } catch (e) {
    console.error(e);
    renderParentPlaceholder(e.message || "source master の取得に失敗しました");
    renderChildPlaceholder("親一覧から1件選択してください。");
    if (detailPre) detailPre.textContent = e.message || "source master の取得に失敗しました";
  }
});
