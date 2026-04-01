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

  let allQueues = [];
  let selectedQueueName = "";

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

  function parseQueueShortName(queue) {
    const fullName = String(queue.name || queue.queue_name || "");
    if (!fullName) return "";
    const parts = fullName.split("/");
    return parts[parts.length - 1] || fullName;
  }

  function parseTaskShortName(task) {
    const fullName = String(task.name || task.short_name || "");
    if (!fullName) return "";
    const parts = fullName.split("/");
    return task.short_name || parts[parts.length - 1] || fullName;
  }

  function normalizeTaskState(task) {
    const dispatchCount = Number(task.dispatch_count ?? 0);
    const responseCount = Number(task.response_count ?? 0);

    if (responseCount > 0) {
      return "retry";
    }
    if (dispatchCount > 0) {
      return "running";
    }
    return "queued";
  }

  function taskStateClass(state) {
    if (state === "running") return "jm-status jm-status-running";
    if (state === "retry") return "jm-status jm-status-retry";
    if (state === "error") return "jm-status jm-status-error";
    return "jm-status jm-status-queued";
  }

  function renderQueues() {
    queueSummary.textContent = `キュー件数: ${allQueues.length}`;

    if (!allQueues.length) {
      queueList.innerHTML = `<div class="jm-empty">キューはありません。</div>`;
      taskPanelTitle.textContent = "タスク一覧";
      taskSummary.textContent = "タスク件数: 0";
      taskTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">キューを選択してください。</td>
        </tr>
      `;
      return;
    }

    queueList.innerHTML = allQueues.map((queue) => {
      const queueName = parseQueueShortName(queue);
      const fullName = String(queue.name || "");
      const state = String(queue.state || "-");
      const taskCount = Number(queue.task_count ?? 0);
      const activeClass = selectedQueueName === queueName ? "active" : "";

      return `
        <button
          type="button"
          class="jm-queue-item ${activeClass}"
          data-queue-name="${escapeHtml(queueName)}"
        >
          <div class="jm-queue-name">${escapeHtml(queueName)}</div>
          <div class="jm-queue-meta">
            状態: ${escapeHtml(state)}<br>
            残TASK数: ${taskCount}
          </div>
        </button>
      `;
    }).join("");

    queueList.querySelectorAll(".jm-queue-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const queueName = btn.dataset.queueName || "";
        if (!queueName) return;
        selectedQueueName = queueName;
        renderQueues();
        fetchTasks(queueName);
      });
    });
  }

  function renderTasks(queueName, tasks) {
    taskPanelTitle.textContent = queueName ? `タスク一覧: ${queueName}` : "タスク一覧";
    taskSummary.textContent = `タスク件数: ${tasks.length}`;

    if (!tasks.length) {
      taskTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">このキューに残TASKはありません。</td>
        </tr>
      `;
      return;
    }

    taskTableBody.innerHTML = tasks.map((task) => {
      const state = normalizeTaskState(task);
      const taskName = parseTaskShortName(task) || "-";
      const scheduleTime = task.schedule_time || "";
      const dispatchCount = Number(task.dispatch_count ?? 0);
      const responseCount = Number(task.response_count ?? 0);
      const url = String(task.url || "");

      return `
        <tr>
          <td><span class="${taskStateClass(state)}">${escapeHtml(state)}</span></td>
          <td class="jm-col-name">${escapeHtml(taskName)}</td>
          <td>${escapeHtml(formatDateTime(scheduleTime))}</td>
          <td>${dispatchCount}</td>
          <td>${responseCount}</td>
          <td class="jm-col-url">${escapeHtml(url)}</td>
        </tr>
      `;
    }).join("");
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

  async function fetchQueues() {
    log("キュー一覧を取得します。");

    try {
      const data = await fetchJsonOrThrow(`${API_BASE}/v1/admin/task-queues`);

      allQueues = Array.isArray(data)
        ? data
        : Array.isArray(data.queues)
          ? data.queues
          : [];

      log(`キュー一覧取得完了: ${allQueues.length} 件`);
      renderQueues();

      if (selectedQueueName) {
        const exists = allQueues.some((q) => parseQueueShortName(q) === selectedQueueName);
        if (exists) {
          await fetchTasks(selectedQueueName);
          return;
        }
      }

      if (allQueues.length > 0) {
        selectedQueueName = parseQueueShortName(allQueues[0]);
        renderQueues();
        await fetchTasks(selectedQueueName);
      } else {
        selectedQueueName = "";
        renderTasks("", []);
      }
    } catch (err) {
      console.error(err);
      log(`キュー一覧取得失敗: ${err.message}`);
      allQueues = [];
      renderQueues();
    }
  }

  async function fetchTasks(queueName) {
    if (!queueName) {
      renderTasks("", []);
      return;
    }

    log(`タスク一覧を取得します: ${queueName}`);

    try {
      const data = await fetchJsonOrThrow(
        `${API_BASE}/v1/admin/task-queues/${encodeURIComponent(queueName)}/tasks`
      );

      const tasks = Array.isArray(data)
        ? data
        : Array.isArray(data.tasks)
          ? data.tasks
          : [];

      log(`タスク一覧取得完了: ${queueName} / ${tasks.length} 件`);
      renderTasks(queueName, tasks);
    } catch (err) {
      console.error(err);
      log(`タスク一覧取得失敗: ${queueName} / ${err.message}`);
      taskPanelTitle.textContent = `タスク一覧: ${queueName}`;
      taskSummary.textContent = "タスク件数: 0";
      taskTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="jm-empty">タスク一覧の取得に失敗しました。</td>
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
      fetchQueues();
    });
  }

  fetchQueues();
});
