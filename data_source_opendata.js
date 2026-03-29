console.log("data_source_opendata.js loaded");

(function () {
  function getDatasetListEl() {
    return document.getElementById("openDataDatasetList");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function readErrorText(res) {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  function resetOpenDataArea() {
    const datasetList = getDatasetListEl();
    if (datasetList) {
      datasetList.innerHTML = `<div class="placeholder">まだ取得していません</div>`;
    }
  }

  function formatExt(ext) {
    const v = String(ext ?? "").trim();
    return v ? v.toUpperCase() : "-";
  }

  function formatStatus(status) {
    const v = String(status ?? "").trim().toLowerCase();
    if (!v) return "new";
    return v;
  }

  function toStatusLabel(status) {
    const v = formatStatus(status);
    if (v === "done") return "取得済";
    if (v === "new") return "未取得";
    return v;
  }

  function statusClassName(status) {
    const v = formatStatus(status);
    if (v === "done") return "status-done";
    if (v === "error") return "status-error";
    return "status-new";
  }

  function buildDatasetRow(item) {
    const status = formatStatus(item.status);
    const done = status === "done";
    const ext = formatExt(item.ext);
    const originalName = String(item.original_name ?? "").trim();
    const title = String(item.title ?? "").trim();
    const datasetId = String(item.dataset_id ?? "").trim();
    const displayStatus = toStatusLabel(status);
    const chipClass = statusClassName(status);

    const actionHtml = done
      ? `<span class="url-chip status-done">取得済</span>`
      : `
        <button
          type="button"
          class="btn btn-primary btn-dataset-expand"
          data-dataset-id="${escapeHtml(datasetId)}"
          data-dataset-title="${escapeHtml(title)}"
        >
          取得
        </button>
      `;

    return `
      <div class="opendata-row" data-dataset-id="${escapeHtml(datasetId)}">
        <div class="opendata-col-title" title="${escapeHtml(title)}">
          ${escapeHtml(title)}
        </div>

        <div class="opendata-col-ext">
          <span class="url-chip">${escapeHtml(ext)}</span>
        </div>

        <div class="opendata-col-status">
          <span class="url-chip ${chipClass}">${escapeHtml(displayStatus)}</span>
        </div>

        <div class="opendata-col-name" title="${escapeHtml(originalName)}">
          ${originalName ? escapeHtml(originalName) : ""}
        </div>

        <div class="opendata-col-action">
          ${actionHtml}
        </div>
      </div>
    `;
  }

  function renderDatasets(items, handlers, writeLog) {
    const wrap = getDatasetListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">データセットがありません</div>`;
      return;
    }

    wrap.innerHTML = items.map((item) => buildDatasetRow(item)).join("");

    const buttons = wrap.querySelectorAll(".btn-dataset-expand");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const datasetId = btn.dataset.datasetId;
        const datasetTitle = btn.dataset.datasetTitle;

        try {
          await handlers.onExpandDataset(datasetId, datasetTitle);
        } catch (e) {
          console.error(e);
          writeLog(`dataset 取得失敗: ${e.message}`);
        }
      });
    });
  }

  async function fetchDatasets({ apiBase, idToken, writeLog, onRender, silent = false }) {
    const res = await fetch(`${apiBase}/opendata/fetch_datasets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`データセット取得失敗: ${text}`);
    }

    const data = await res.json();

    if (!silent) {
      writeLog(`データセット取得完了: ${data.dataset_count ?? 0}件`);
    }

    if (typeof onRender === "function") {
      onRender(data.datasets || []);
    }

    return data;
  }

  async function expandDataset({ apiBase, idToken, datasetId, writeLog }) {
    const url =
      `${apiBase}/opendata/expand_dataset` +
      `?dataset_id=${encodeURIComponent(datasetId)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`dataset 取得失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("dataset 取得完了");
    if (data.source_id) writeLog(`source_id=${data.source_id}`);
    if (data.ext) writeLog(`ext=${data.ext}`);
    if (data.original_name) writeLog(`original_name=${data.original_name}`);
    if (data.gcs_path) writeLog(`gcs_path=${data.gcs_path}`);

    return data;
  }

  window.DataSourceOpenData = {
    resetOpenDataArea,
    renderDatasets,
    fetchDatasets,
    expandDataset
  };
})();
