console.log("data_view.js loaded");

const btnReload = document.getElementById("btnReload");
const btnKnowledge = document.getElementById("btnKnowledge");
const btnParentCheckAll = document.getElementById("btnParentCheckAll");
const btnParentClearAll = document.getElementById("btnParentClearAll");

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
  const res = await fetchWithAuth(path, { method: "GET" }, query, true);

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

function getProgressValues(data) {
  const qaCurrent = Number(data?.qa_current ?? data?.processed_qa_chunks ?? 0);
  const qaTotal = Number(data?.qa_total ?? data?.total_qa_chunks ?? 0);

  const plainCurrent = Number(data?.plain_current ?? data?.processed_plain_chunks ?? 0);
  const plainTotal = Number(data?.plain_total ?? data?.total_plain_chunks ?? 0);

  const chunkCurrent =
    Number(data?.chunk_current ?? data?.processed_chunks ?? (qaCurrent + plainCurrent));
  const chunkTotal =
    Number(data?.chunk_total ?? data?.total_chunks ?? (qaTotal + plainTotal));

  return {
    qaCurrent,
    qaTotal,
    plainCurrent,
    plainTotal,
    chunkCurrent,
    chunkTotal
  };
}

function applyModuleKnowledgeStatus(data) {
  const module = getCurrentModule();
  if (!module || typeof module.applyKnowledgeStatus !== "function") return;

  try {
    module.applyKnowledgeStatus(data);
  } catch (e) {
    console.warn("applyKnowledgeStatus failed", e);
  }
}

function getStatusPathBySourceType(sourceType) {
  if (sourceType === "kokkai") return "/knowledge/kokkai/status";
  if (sourceType === "opendata") return "/knowledge/opendata/status";
  if (sourceType === "public_url") return "/knowledge/url/status";
  if (sourceType === "upload") return "/knowledge/upload/status";
  return "";
}

function getRunPathBySourceType(sourceType) {
  if (sourceType === "kokkai") return "/knowledge/kokkai/run";
  if (sourceType === "opendata") return "/knowledge/opendata/run";
  if (sourceType === "public_url") return "/knowledge/url/run";
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
      <tr>
        <td>${escapeHtml(message)}</td>
      </tr>
    `;
  }
}

function renderChildPlaceholder(message) {
  if (childTableHead) childTableHead.innerHTML = "";
  if (childTableBody) {
    childTableBody.innerHTML = `
      <tr>
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
    apiGet: apiGetForCurrentView,
    apiPost,
    escapeHtml,
    getStatusClass,
    renderParentPlaceholder,
    renderChildPlaceholder,
    btnCheckAll: btnParentCheckAll,
    btnClearChecks: btnParentClearAll
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
  const p = getProgressValues(data);

  const lines = [
    `job_id: ${data?.job_id ?? ""}`,
    `status: ${data?.status ?? ""}`,
    `phase: ${data?.phase ?? ""}`,
    `message: ${data?.message ?? ""}`,
    `selected_count: ${data?.selected_count ?? 0}`,
    `qa_count: ${data?.qa_count ?? data?.knowledge_count ?? 0}`,
    `plain_count: ${data?.plain_count ?? 0}`,
    `error_count: ${data?.error_count ?? 0}`,
    `chunk: ${p.chunkCurrent} / ${p.chunkTotal}`,
    `qa_chunk: ${p.qaCurrent} / ${p.qaTotal}`,
    `plain_chunk: ${p.plainCurrent} / ${p.plainTotal}`,
    `requested_at: ${data?.requested_at ?? ""}`,
    `started_at: ${data?.started_at ?? ""}`,
    `finished_at: ${data?.finished_at ?? ""}`,
    `dataset_id: ${data?.dataset_id ?? ""}`,
    `dataset_name: ${data?.dataset_name ?? ""}`,
    `row_count: ${data?.row_count ?? 0}`,
    `knowledge_count: ${data?.knowledge_count ?? 0}`,
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
  if (attempt > pollingConfig.very_long_after_count) return pollingConfig.long_interval_ms;
  if (attempt > pollingConfig.long_after_count) return pollingConfig.normal_interval_ms;
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

function summarizeJobStatusFallback(data) {
  const total = Number(data?.selected_count ?? 0);
  const status = String(data?.status || "").toLowerCase();

  if (total <= 0) {
    return {
      total: 0,
      doneCountOnly: 0,
      errorCount: 0,
      runningCount: status === "running" ? 1 : 0,
      queuedCount: status === "new" ? 1 : 0,
      doneCount: 0,
      remaining: 0
    };
  }

  if (status === "done") {
    return {
      total,
      doneCountOnly: total,
      errorCount: 0,
      runningCount: 0,
      queuedCount: 0,
      doneCount: total,
      remaining: 0
    };
  }

  if (status === "error") {
    return {
      total,
      doneCountOnly: 0,
      errorCount: total,
      runningCount: 0,
      queuedCount: 0,
      doneCount: total,
      remaining: 0
    };
  }

  return {
    total,
    doneCountOnly: 0,
    errorCount: 0,
    runningCount: status === "running" ? 1 : 0,
    queuedCount: Math.max(0, total - (status === "running" ? 1 : 0)),
    doneCount: 0,
    remaining: total
  };
}

function updateKnowledgeProgressSummary(statusData, selectedCount) {
  const itemSummary = Array.isArray(statusData?.items) && statusData.items.length > 0
    ? summarizeJobItems(statusData.items)
    : summarizeJobStatusFallback({
        ...statusData,
        selected_count: Number(selectedCount || statusData?.selected_count || 0)
      });

  const p = getProgressValues(statusData);
  const statusLabel = String(statusData?.status || "").toLowerCase() || "unknown";

  if (contextSummary) {
    contextSummary.textContent =
      `ナレッジ化: CHUNK ${p.chunkCurrent} / ${p.chunkTotal}（QA ${p.qaCurrent} / ${p.qaTotal}｜PLAIN ${p.plainCurrent} / ${p.plainTotal}｜status: ${statusLabel}）`;
  }

  if (selectionSummary) {
    selectionSummary.textContent =
      `親 ${itemSummary.doneCount} / ${itemSummary.total}（done ${itemSummary.doneCountOnly}｜error ${itemSummary.errorCount}｜実行中 ${itemSummary.runningCount}｜待機 ${itemSummary.queuedCount}）`;
  }

  if (summaryText) {
    summaryText.textContent = `${Number(statusData?.knowledge_count ?? statusData?.qa_count ?? 0) || 0} 件`;
  }

  applyModuleKnowledgeStatus(statusData);
}

async function fetchStatusData(sourceType, jobId) {
  const statusPath = getStatusPathBySourceType(sourceType);
  if (!statusPath) throw new Error("status path が不正です");
  return await apiGet(statusPath, { job_id: jobId });
}

async function runKnowledgeJobAndPoll(sourceType, jobId) {
  const runPath = getRunPathBySourceType(sourceType);
  if (!runPath) {
    throw new Error("run path が不正です");
  }

  await apiPost(runPath, { job_id: jobId });

  let attempt = 0;
  let errorCount = 0;

  while (attempt < pollingConfig.max_attempts) {
    attempt += 1;

    try {
      const statusData = await fetchStatusData(sourceType, jobId);
      errorCount = 0;

      updateKnowledgeProgressSummary(statusData, statusData?.selected_count ?? 0);

      if (detailPre) {
        detailPre.textContent = buildStatusResultText(statusData);
      }

      if (isTerminalJobStatus(statusData?.status)) {
        clearActiveKnowledgeJob();
        return statusData;
      }
    } catch (e) {
      errorCount += 1;
      console.error("polling error", e);

      if (detailPre) {
        detailPre.textContent = e.message || "ステータス取得に失敗しました。";
      }

      if (errorCount >= pollingConfig.max_error_count) {
        throw e;
      }
    }

    await sleep(getPollingIntervalMs(attempt));
  }

  throw new Error("ナレッジ化の監視がタイムアウトしました");
}

async function resumeKnowledgePollingIfNeeded() {
  const previous = loadActiveKnowledgeJob();
  if (!previous) return;

  const validated = await validateStoredActiveJob(previous);
  if (!validated) return;

  if (!sourceMap[previous.source_key]) {
    clearActiveKnowledgeJob();
    return;
  }

  currentSourceKey = previous.source_key;

  const sourceSelect = getSourceSelect();
  if (sourceSelect) {
    sourceSelect.value = currentSourceKey;
  }

  await refreshParentList();

  const source = sourceMap[currentSourceKey];
  if (!source?.sourceType) {
    clearActiveKnowledgeJob();
    return;
  }

  setKnowledgeBusy(true);

  try {
    if (detailPre) {
      detailPre.textContent = "前回のナレッジ化ジョブを再接続しています...";
    }

    const statusData = await runKnowledgeJobAndPoll(source.sourceType, validated.job_id);
    await finalizeKnowledgePolling(statusData, previous.selected_count || 0);
  } catch (e) {
    console.error(e);
    if (detailPre) {
      detailPre.textContent = e.message || "ジョブ再接続に失敗しました。";
    }
  } finally {
    setKnowledgeBusy(false);
  }
}

async function finalizeKnowledgePolling(statusData, checkedCount) {
  if (detailPre) {
    detailPre.textContent = buildStatusResultText(statusData);
  }

  if (String(statusData?.status || "").toLowerCase() === "done") {
    alert("ナレッジ化が完了しました");
  } else if (String(statusData?.status || "").toLowerCase() === "error") {
    alert(statusData?.error_message || "ナレッジ化でエラーが発生しました");
  }

  updateKnowledgeProgressSummary(statusData, checkedCount);

  try {
    await refreshParentList();
  } catch (e) {
    console.error(e);
  }
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
    const payload = {
      source_type: source.sourceType,
      source_key: source.key,
      items: checkedRows
    };

    const jobData = await apiPost("/knowledge/jobs", payload);

    const jobId = String(jobData?.job_id || "");
    if (!jobId) {
      throw new Error("job_id が取得できませんでした");
    }

    saveActiveKnowledgeJob({
      job_id: jobId,
      source_type: source.sourceType,
      source_key: source.key,
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
  document.addEventListener("toolbar:ready", async (event) => {
    const detail = event.detail || {};
    const list = Array.isArray(detail.sourceList) ? detail.sourceList : [];
    sourceList = normalizeSourceMaster(list);
    sourceMap = {};

    sourceList.forEach((item) => {
      sourceMap[item.key] = item;
    });

    renderInitialScreen();

    try {
      await resumeKnowledgePollingIfNeeded();
    } catch (e) {
      console.error(e);
      renderParentPlaceholder(e.message || "ジョブ再接続に失敗しました");
      renderChildPlaceholder("親一覧から1件選択してください。");
      if (detailPre) detailPre.textContent = e.message || "ジョブ再接続に失敗しました";
    }
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

  btnParentCheckAll?.addEventListener("click", () => {
    const module = getCurrentModule();
    if (module && typeof module.checkAll === "function") {
      module.checkAll();
    }
  });

  btnParentClearAll?.addEventListener("click", () => {
    const module = getCurrentModule();
    if (module && typeof module.clearAllChecks === "function") {
      module.clearAllChecks();
    }
  });
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
  } catch (e) {
    console.warn("polling_config load failed", e);
    pollingConfig = { ...DEFAULT_POLLING_CONFIG };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  renderInitialScreen();
  await loadPollingConfig();
});
