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
      .replace(/"/g, "&quot;")
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

  function formatRowCount(rowCount) {
    if (rowCount === null || rowCount === undefined || rowCount === "") {
      return "-";
    }
    return String(rowCount);
  }

  function formatStatus(status) {
    const v = String(status ?? "").trim().toLowerCase();
    if (!v) return "new";
    return v;
  }

  function renderDatasets(items, handlers, writeLog) {
    const wrap = getDatasetListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">データセットがありません</div>`;
      return;
    }

    wrap.innerHTML = items.map((item) => {
      const status = formatStatus(item.status);
      const done = status === "done";
      const rowCount = formatRowCount(item.row_count);
      const ext = formatExt(item.ext);

      return `
        <div class="choice-row">
          <div class="choice-title-line" title="${escapeHtml(item.title)}">
            ${escapeHtml(item.title)}
          </div>

          <div class="choice-meta-line">
            種別: ${escapeHtml(ext)} ／ 件数: ${escapeHtml(rowCount)} ／ 状態: ${escapeHtml(status)}
          </div>

          <div class="choice-button-line">
            ${
              done
                ? `<span class="choice-done-text">完了</span>`
                : `
                  <button
                    type="button"
                    class="btn btn-primary btn-dataset-expand"
                    data-dataset-id="${escapeHtml(item.dataset_id)}"
                    data-dataset-title="${escapeHtml(item.title)}"
                  >
                    分解
                  </button>
                `
            }
          </div>
        </div>
      `;
    }).join("");

    const buttons = wrap.querySelectorAll(".btn-dataset-expand");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const datasetId = btn.dataset.datasetId;
        const datasetTitle = btn.dataset.datasetTitle;

        try {
          await handlers.onExpandDataset(datasetId, datasetTitle);
        } catch (e) {
          console.error(e);
          writeLog(`dataset 分解失敗: ${e.message}`);
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
      throw new Error(`dataset 分解失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("dataset 分解完了");
    if (data.source_id) writeLog(`source_id=${data.source_id}`);
    if (data.ext) writeLog(`ext=${data.ext}`);
    if (typeof data.row_inserted === "number") writeLog(`row_inserted=${data.row_inserted}`);
    if (typeof data.row_skipped === "number") writeLog(`row_skipped=${data.row_skipped}`);

    return data;
  }

  window.DataSourceOpenData = {
    resetOpenDataArea,
    renderDatasets,
    fetchDatasets,
    expandDataset
  };
})();
