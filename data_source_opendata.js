console.log("data_source_opendata.js loaded");

(function () {
  function getDatasetListEl() {
    return document.getElementById("openDataDatasetList");
  }

  function getResourceListEl() {
    return document.getElementById("openDataResourceList");
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
    const resourceList = getResourceListEl();

    if (datasetList) {
      datasetList.innerHTML = `<div class="placeholder">まだ取得していません</div>`;
    }
    if (resourceList) {
      resourceList.innerHTML = `<div class="placeholder">まだ分解していません</div>`;
    }
  }

  function renderDatasets(items, handlers, writeLog) {
    const wrap = getDatasetListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">データセットがありません</div>`;
      return;
    }

    wrap.innerHTML = items.map((item) => {
      return `
        <div class="choice-item">
          <div class="choice-main">
            <div class="choice-title">${escapeHtml(item.title)}</div>
            <div class="choice-meta">
              dataset_id: ${escapeHtml(item.dataset_id)}<br>
              resources: ${escapeHtml(item.resource_count)}
            </div>
          </div>
          <div class="choice-actions">
            <button
              type="button"
              class="btn btn-primary btn-dataset-expand"
              data-dataset-id="${escapeHtml(item.dataset_id)}"
              data-dataset-title="${escapeHtml(item.title)}"
            >
              分解
            </button>
          </div>
        </div>
      `;
    }).join("");

    const buttons = wrap.querySelectorAll(".btn-dataset-expand");
    buttons.forEach((btn) => {
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

  function renderResources(items, datasetId, datasetTitle, handlers, writeLog) {
    const wrap = getResourceListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">resource がありません</div>`;
      return;
    }

    wrap.innerHTML = items.map((item) => {
      const allowed = !!item.allowed;
      return `
        <div class="choice-item">
          <div class="choice-main">
            <div class="choice-title">${escapeHtml(item.resource_name)}</div>
            <div class="choice-meta">
              resource_id: ${escapeHtml(item.resource_id)}<br>
              format: ${escapeHtml(item.format || "-")} /
              kind: ${escapeHtml(item.kind || "-")} /
              ${allowed ? "対象" : "対象外"}
            </div>
          </div>
          <div class="choice-actions">
            ${
              allowed
                ? `
                <button
                  type="button"
                  class="btn btn-primary btn-resource-register"
                  data-dataset-id="${escapeHtml(datasetId)}"
                  data-dataset-title="${escapeHtml(datasetTitle)}"
                  data-resource-id="${escapeHtml(item.resource_id)}"
                  data-resource-name="${escapeHtml(item.resource_name)}"
                >
                  登録
                </button>
                `
                : `
                <button type="button" class="btn" disabled>
                  対象外
                </button>
                `
            }
          </div>
        </div>
      `;
    }).join("");

    const buttons = wrap.querySelectorAll(".btn-resource-register");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const datasetId2 = btn.dataset.datasetId;
        const resourceId = btn.dataset.resourceId;
        const resourceName = btn.dataset.resourceName;

        writeLog(`resource 登録開始: ${resourceName}`);

        try {
          await handlers.onRegisterResource(datasetId2, resourceId, resourceName);
        } catch (e) {
          console.error(e);
          writeLog(`resource 登録失敗: ${e.message}`);
        }
      });
    });
  }

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

  async function fetchResources({ apiBase, idToken, datasetId, writeLog }) {
    const url = `${apiBase}/opendata/fetch_resources?dataset_id=${encodeURIComponent(datasetId)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`resource 取得失敗: ${text}`);
    }

    const data = await res.json();
    writeLog(`resource 取得完了: ${data.resource_count ?? 0}件`);
    return data;
  }

  async function registerResource({ apiBase, idToken, datasetId, resourceId, writeLog }) {
    const url =
      `${apiBase}/opendata/register_resource` +
      `?dataset_id=${encodeURIComponent(datasetId)}` +
      `&resource_id=${encodeURIComponent(resourceId)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (res.status === 409) {
      const text = await readErrorText(res);
      throw new Error(`登録済み(409): ${text}`);
    }

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`resource 登録失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("resource 登録完了");
    if (data.source_id) writeLog(`source_id=${data.source_id}`);
    if (data.logical_name) writeLog(`logical_name=${data.logical_name}`);
    if (data.ext) writeLog(`ext=${data.ext}`);
    if (typeof data.row_inserted === "number") writeLog(`row_inserted=${data.row_inserted}`);
    if (typeof data.row_skipped === "number") writeLog(`row_skipped=${data.row_skipped}`);

    return data;
  }

  window.DataSourceOpenData = {
    resetOpenDataArea,
    renderDatasets,
    renderResources,
    fetchDatasets,
    fetchResources,
    registerResource
  };
})();
