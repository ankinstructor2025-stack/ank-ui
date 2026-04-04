document.addEventListener("DOMContentLoaded", () => {
  const API_BASE =
    window.API_BASE ||
    localStorage.getItem("API_BASE") ||
    "https://ank-api-986862757498.asia-northeast1.run.app";

  const btnBackMenu = document.getElementById("btn-back-menu");
  const btnRefresh = document.getElementById("btn-refresh");
  const queueSummary = document.getElementById("queueSummary");
  const queueList = document.getElementById("queueList");
  const taskPanelTitle = document.getElementById("taskPanelTitle");
  const taskSummary = document.getElementById("taskSummary");
  const taskTableBody = document.getElementById("taskTableBody");
  const jobLog = document.getElementById("jobLog");

  let allJobs = [];
  let selectedJobId = "";

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
    const ss = String(dt.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  function jobStatusClass(status) {
    if (status === "running") return "jm-status jm-status-running";
    if (status === "partial_error" || status === "error") return "jm-status jm-status-error";
    if (status === "done") return "jm-status jm-status-retry";
    return "jm-status jm-status-queued";
  }

  async function fetchJsonOrThrow(url) {
    const idToken = getIdToken();
    if (!idToken) {
      throw new Error("idToken がありません。ログインし直してください。");
    }

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
  }

  function renderJobs() {
    queueSummary.textContent = `ジョブ件数: ${allJobs.length}`;

    if (!allJobs.length) {
      queueList.innerHTML = `<div class="jm-empty">ジョブはありません。</div>`;
      taskPanelTitle.textContent = "ジョブ詳細";
      taskSummary.textContent = "詳細件数: 0";
      taskTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">ジョブを選択してください。</td>
        </tr>
      `;
      return;
    }

    queueList.innerHTML = allJobs.map((job) => {
      const jobId = String(job.job_id || "");
      const status = String(job.status || "-");
      const phase = String(job.phase || "-");
      const doneChunks = Number(job.done_chunks ?? 0);
      const totalChunks = Number(job.total_chunks ?? 0);
      const qaCount = Number(job.qa_count ?? 0);
      const plainCount = Number(job.plain_count ?? 0);
      const activeClass = selectedJobId === jobId ? "active" : "";

      return `
        <button
          type="button"
          class="jm-queue-item ${activeClass}"
          data-job-id="${escapeHtml(jobId)}"
        >
          <div class="jm-queue-name">${escapeHtml(jobId)}</div>
          <div class="jm-queue-meta">
            状態: ${escapeHtml(status)}<br>
            フェーズ: ${escapeHtml(phase)}<br>
            進捗: ${doneChunks}/${totalChunks}<br>
            QA: ${qaCount} / Plain: ${plainCount}
          </div>
        </button>
      `;
    }).join("");

    queueList.querySelectorAll(".jm-queue-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const jobId = btn.dataset.jobId || "";
        if (!jobId) return;
        selectedJobId = jobId;
        renderJobs();
        renderJobDetail(jobId);
      });
    });
  }

  function renderJobDetail(jobId) {
    const job = allJobs.find((x) => String(x.job_id || "") === String(jobId || ""));

    taskPanelTitle.textContent = jobId ? `ジョブ詳細: ${jobId}` : "ジョブ詳細";

    if (!job) {
      taskSummary.textContent = "詳細件数: 0";
      taskTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">ジョブ詳細がありません。</td>
        </tr>
      `;
      return;
    }

    taskSummary.textContent = `状態: ${job.status || "-"} / 更新: ${formatDateTime(job.updated_at || "")}`;

    const rows = [
      ["状態", `<span class="${jobStatusClass(job.status || "")}">${escapeHtml(job.status || "-")}</span>`],
      ["フェーズ", escapeHtml(job.phase || "-")],
      ["source_type", escapeHtml(job.source_type || "-")],
      ["source_name", escapeHtml(job.source_name || "-")],
      ["request_type", escapeHtml(job.request_type || "-")],
      ["選択件数", escapeHtml(job.selected_count ?? 0)],
      ["総chunk数", escapeHtml(job.total_chunks ?? 0)],
      ["完了chunk数", escapeHtml(job.done_chunks ?? 0)],
      ["エラーchunk数", escapeHtml(job.error_chunks ?? 0)],
      ["QA件数", escapeHtml(job.qa_count ?? 0)],
      ["Plain件数", escapeHtml(job.plain_count ?? 0)],
      ["依頼日時", escapeHtml(formatDateTime(job.requested_at || ""))],
      ["開始日時", escapeHtml(formatDateTime(job.started_at || ""))],
      ["終了日時", escapeHtml(formatDateTime(job.finished_at || ""))],
      ["更新日時", escapeHtml(formatDateTime(job.updated_at || ""))],
      ["エラー内容", escapeHtml(job.error_message || "")]
    ];

    taskTableBody.innerHTML = rows.map(([name, value]) => `
      <tr>
        <td>${name}</td>
        <td colspan="5" class="jm-col-url">${value}</td>
      </tr>
    `).join("");
  }

  async function fetchJobs() {
    log("ジョブ一覧を取得します。");

    try {
      const data = await fetchJsonOrThrow(`${API_BASE}/v1/job-status`);

      const jobs = Array.isArray(data)
        ? data
        : Array.isArray(data.jobs)
          ? data.jobs
          : [];

      allJobs = jobs.sort((a, b) => {
        const aa = String(a.updated_at || a.requested_at || "");
        const bb = String(b.updated_at || b.requested_at || "");
        return aa < bb ? 1 : aa > bb ? -1 : 0;
      });

      log(`ジョブ一覧取得完了: ${allJobs.length} 件`);
      renderJobs();

      if (selectedJobId) {
        const exists = allJobs.some((j) => String(j.job_id || "") === selectedJobId);
        if (exists) {
          renderJobDetail(selectedJobId);
          return;
        }
      }

      if (allJobs.length > 0) {
        selectedJobId = String(allJobs[0].job_id || "");
        renderJobs();
        renderJobDetail(selectedJobId);
      } else {
        selectedJobId = "";
      }

    } catch (err) {
      console.error(err);
      log(`ジョブ一覧取得失敗: ${err.message}`);
      allJobs = [];
      renderJobs();
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

  fetchJobs();
});
