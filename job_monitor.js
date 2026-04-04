document.addEventListener("DOMContentLoaded", () => {
const API_BASE =
window.API_BASE ||
localStorage.getItem("API_BASE") ||
"https://ank-api-986862757498.asia-northeast1.run.app";

const btnBackMenu = document.getElementById("btn-back-menu");
const btnRefresh = document.getElementById("btn-refresh");
const queueSummary = document.getElementById("queueSummary");
const queueList = document.getElementById("queueList");
const jobLog = document.getElementById("jobLog");

function log(message) {
const now = new Date();
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");
const ss = String(now.getSeconds()).padStart(2, "0");
jobLog.textContent += `\n[${hh}:${mm}:${ss}] ${message}`;
jobLog.scrollTop = jobLog.scrollHeight;
}

function getIdToken() {
return sessionStorage.getItem("idToken") || localStorage.getItem("idToken") || "";
}

function escapeHtml(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function formatDateTime(value) {
if (!value) return "";
const dt = new Date(value);
if (Number.isNaN(dt.getTime())) return String(value);
const y = dt.getFullYear();
const m = String(dt.getMonth() + 1).padStart(2, "0");
const d = String(dt.getDate()).padStart(2, "0");
const hh = String(dt.getHours()).padStart(2, "0");
const mm = String(dt.getMinutes()).padStart(2, "0");
const ss = String(dt.getSeconds()).padStart(2, "0");
return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function fetchJsonOrThrow(url) {
const idToken = getIdToken();
if (!idToken) {
throw new Error("idToken がありません。ログインし直してください。");
}

```
const res = await fetch(url, {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${idToken}`
  }
});

let data = null;
let text = "";

try {
  data = await res.json();
} catch (_) {
  try {
    text = await res.text();
  } catch (_) {
    text = "";
  }
}

if (!res.ok) {
  const detail =
    (data && (data.detail || data.message || data.error)) ||
    text ||
    `HTTP ${res.status} ${res.statusText}`;
  throw new Error(detail);
}

return data;
```

}

function renderJobs(jobs) {
queueSummary.textContent = `ジョブ件数: ${jobs.length}`;

```
if (!jobs.length) {
  queueList.innerHTML = `<div class="jm-empty">ジョブはありません。</div>`;
  return;
}

queueList.innerHTML = jobs.map((job) => {
  const status = job.status || "-";
  const phase = job.phase || "-";

  const progress =
    job.total_chunks > 0
      ? `${job.done_chunks}/${job.total_chunks}`
      : "-";

  return `
    <div class="jm-queue-item">
      <div class="jm-queue-name">${escapeHtml(job.job_id)}</div>
      <div class="jm-queue-meta">
        状態: ${escapeHtml(status)}<br>
        フェーズ: ${escapeHtml(phase)}<br>
        進捗: ${progress}<br>
        QA: ${job.qa_count ?? 0} / PLAIN: ${job.plain_count ?? 0}<br>
        更新: ${escapeHtml(formatDateTime(job.updated_at))}
      </div>
    </div>
  `;
}).join("");
```

}

async function fetchJobs() {
log("ジョブ一覧を取得します。");

```
try {
  const data = await fetchJsonOrThrow(`${API_BASE}/v1/job-status`);

  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  log(`ジョブ一覧取得完了: ${jobs.length} 件`);
  renderJobs(jobs);

} catch (err) {
  console.error(err);
  log(`ジョブ一覧取得失敗: ${err.message}`);
  queueList.innerHTML = `<div class="jm-empty">取得失敗</div>`;
}
```

}

if (btnBackMenu) {
btnBackMenu.addEventListener("click", () => {
window.location.href = "menu.html";
});
}

if (btnRefresh) {
btnRefresh.addEventListener("click", () => {
fetchJobs();
});
}

fetchJobs();
});
