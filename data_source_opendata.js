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

  /*
  --------------------------------------
  dataset 一覧表示
  --------------------------------------
  */

  function renderDatasets(items, handlers, writeLog) {

    const wrap = getDatasetListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">データセットがありません</div>`;
      return;
    }

    wrap.innerHTML = items.map(item => {

      const status = item.status || "new";
      const done = status === "done";

      return `
        <div class="choice-item">

          <div class="choice-main">
            <div class="choice-title">
              ${escapeHtml(item.title)}
            </div>

            <div class="choice-meta">
              dataset_id: ${escapeHtml(item.dataset_id)}<br>
              status: ${escapeHtml(status)}<br>
              rows: ${escapeHtml(item.row_count ?? "-")}
            </div>
          </div>

          <div class="choice-actions">

            ${
              done
                ? `<button class="btn" disabled>分解済</button>`
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

    buttons.forEach(btn => {

      btn.addEventListener("click", async () => {

        const datasetId = btn.dataset.datasetId;
        const datasetTitle = btn.dataset.datasetTitle;

        writeLog(`dataset 分解開始: ${datasetTitle}`);

        try {

          await handlers.onExpandDataset(datasetId, datasetTitle);

        } catch (e) {

          console.error(e);
          writeLog(`dataset 分解失敗: ${e.message}`);

        }

      });

    });

  }

  /*
  --------------------------------------
  dataset取得
  --------------------------------------
  */

  async function fetchDatasets({ apiBase, idToken, writeLog, onRender }) {

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

    writeLog(`データセット取得完了: ${data.dataset_count ?? 0}件`);

    if (typeof onRender === "function") {
      onRender(data.datasets || []);
    }

    return data;

  }

  /*
  --------------------------------------
  dataset 分解
  --------------------------------------
  */

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

    writeLog(`row_data 登録完了`);
    writeLog(`row_inserted=${data.row_inserted}`);

    return data;

  }

  window.DataSourceOpenData = {

    resetOpenDataArea,
    renderDatasets,
    fetchDatasets,
    expandDataset

  };

})();
