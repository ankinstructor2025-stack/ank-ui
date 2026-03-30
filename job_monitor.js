document.addEventListener("DOMContentLoaded", () => {
  const API_BASE =
    window.API_BASE ||
    localStorage.getItem("API_BASE") ||
    "https://ank-api-986862757498.asia-northeast1.run.app";

  const btnBackMenu = document.getElementById("btn-back-menu");
  const btnRefresh = document.getElementById("btn-refresh");
  const jobTypeFilter = document.getElementById("jobTypeFilter");
  const jobStatusFilter = document.getElementById("jobStatusFilter");
  const jobSummary = document.getElementById("jobSummary");
  const jobTableBody = document.getElementById("jobTableBody");
  const jobLog = document.getElementById("jobLog");

  let allJobs = [];

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
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  function normalizeStatus(status) {
    const s = String(status || "").toLowerCase();
    if (!s) return "queued";
    return s;
  }

  function calcProgress(job) {
    const total =
      Number(job.total_chunks ?? job.chunk_total ?? job.total ?? 0);
    const current =
      Number(job.processed_chunks ?? job.chunk_current ?? job.current ?? 0);

    if (total > 0) {
      const rate = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
      return {
        current,
        total,
        rate,
        text: `${current} / ${total}`
      };
    }

    const status = normalizeStatus(job.status);
    if (status === "done") {
      return { current: 1, total: 1, rate: 100, text: "完了" };
    }
    if (status === "error") {
      return { current: 0, total: 1, rate: 0, text: "エラー" };
    }
    return { current: 0, total: 0, rate: 0, text: "-" };
  }

  function statusClass(status) {
    const s = normalizeStatus(status);
    if (s === "running") return "jm-status jm-status-running";
    if (s === "done") return "jm-status jm-status-done";
    if (s === "error") return "jm-status jm-status-error";
    return "jm-status jm-status-queued";
  }

  function renderJobs(jobs) {
    jobSummary.textContent = `ジョブ件数: ${jobs.length}`;

    if (!jobs.length) {
      jobTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">該当するジョブはありません。</td>
        </tr>
      `;
      return;
    }

    jobTableBody.innerHTML = jobs.map((job) => {
      const progress = calcProgress(job);
      const startedAt =
        job.started_at || job.requested_at || job.created_at || "";
      const jobType =
        job.job_type || job.type || job.source_type || "knowledge";
      const target =
        job.target_name || job.source_name || job.source_key || job.job_id || "-";
      const status = normalizeStatus(job.status);
      const message =
        job.message || job.error_message || job.detail || "";

      return `
        <tr>
          <td>${escapeHtml(formatDateTime(startedAt))}</td>
          <td>${escapeHtml(jobType)}</td>
          <td class="jm-col-target">${escapeHtml(target)}</td>
          <td><span class="${statusClass(status)}">${escapeHtml(status)}</span></td>
          <td class="jm-progress">
            <div class="jm-progress-bar">
              <div class="jm-progress-fill" style="width:${progress.rate}%"></div>
            </div>
            <div class="jm-progress-text">${escapeHtml(progress.text)}</div>
          </td>
          <td class="jm-col-message">${escapeHtml(message)}</td>
        </tr>
      `;
    }).join("");
  }

  function applyFilter() {
    const typeValue = jobTypeFilter.value;
    const statusValue = jobStatusFilter.value;

    const filtered = allJobs.filter((job) => {
      const jobType = String(job.job_type || job.type || job.source_type || "knowledge");
      const status = normalizeStatus(job.status);

      if (typeValue && jobType !== typeValue) return false;
      if (statusValue && status !== statusValue) return false;
      return true;
    });

    renderJobs(filtered);
  }

  async function fetchJobs() {
    const idToken = getIdToken();
    if (!idToken) {
      log("idToken がありません。ログイン画面へ戻ります。");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
      return;
    }

    log("ジョブ一覧を取得します。");

    try {
      const res = await fetch(`${API_BASE}/v1/knowledge/jobs`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // 想定:
      // { jobs: [...] }
      // または { rows: [...] }
      // または配列
      allJobs = Array.isArray(data)
        ? data
        : Array.isArray(data.jobs)
          ? data.jobs
          : Array.isArray(data.rows)
            ? data.rows
            : [];

      log(`ジョブ一覧取得完了: ${allJobs.length} 件`);
      applyFilter();
    } catch (err) {
      console.error(err);
      log(`ジョブ一覧取得失敗: ${err.message}`);
      jobTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">ジョブ一覧の取得に失敗しました。</td>
        </tr>
      `;
    }
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

  if (jobTypeFilter) {
    jobTypeFilter.addEventListener("change", applyFilter);
  }

  if (jobStatusFilter) {
    jobStatusFilter.addEventListener("change", applyFilter);
  }

  fetchJobs();
});
