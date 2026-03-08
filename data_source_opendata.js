console.log("data_source_opendata.js loaded");

(function () {
  async function readErrorText(res) {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  function getDatasetListEl() {
    return document.getElementById("openDataDatasetList");
  }

  function getSelectedDatasetEl() {
    return document.getElementById("openDataSelectedDataset");
  }

  function getResourceListEl() {
    return document.getElementById("openDataResourceList");
  }

  function getSelectedResourceEl() {
    return document.getElementById("openDataSelectedResource");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clearResources() {
    const resourceList = getResourceListEl();
    const selectedResource = getSelectedResourceEl();

    if (resourceList) {
      resourceList.innerHTML = `<div class="placeholder">まだ分解していません</div>`;
    }

    if (selectedResource) {
      selectedResource.textContent = "未選択";
      selectedResource.dataset.resourceId = "";
      selectedResource.dataset.resourceName = "";
    }
  }

  function setSelectedDataset(dataset) {
    const el = getSelectedDatasetEl();
    if (!el) return;

    if (!dataset) {
      el.textContent = "未選択";
      el.dataset.datasetId = "";
      el.dataset.datasetTitle = "";
      clearResources();
      return;
    }

    el.textContent = `${dataset.title} (${dataset.dataset_id})`;
    el.dataset.datasetId = dataset.dataset_id;
    el.dataset.datasetTitle = dataset.title;
    clearResources();
  }

  function setSelectedResource(resource) {
    const el = getSelectedResourceEl();
    if (!el) return;

    if (!resource) {
      el.textContent = "未選択";
      el.dataset.resourceId = "";
      el.dataset.resourceName = "";
      return;
    }

    el.textContent = `${resource.resource_name} (${resource.resource_id})`;
    el.dataset.resourceId = resource.resource_id;
    el.dataset.resourceName = resource.resource_name;
  }

  function renderDatasets(items, writeLog) {
    const wrap = getDatasetListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">データセットがありません</div>`;
      setSelectedDataset(null);
      return;
    }

    wrap.innerHTML = items.map((item, idx) => {
      return `
        <label class="choice-item">
          <input
            type="radio"
            name="opendataDataset"
            value="${escapeHtml(item.dataset_id)}"
            data-dataset-id="${escapeHtml(item.dataset_id)}"
            data-title="${escapeHtml(item.title)}"
            ${idx === 0 ? "checked" : ""}
          />
          <span class="choice-main">
            <span class="choice-title">${escapeHtml(item.title)}</span>
            <span class="choice-meta">
              dataset_id: ${escapeHtml(item.dataset_id)}<br>
              resources: ${escapeHtml(item.resource_count)}
            </span>
          </span>
        </label>
      `;
    }).join("");

    const radios = wrap.querySelectorAll('input[name="opendataDataset"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        setSelectedDataset({
          dataset_id: radio.dataset.datasetId,
          title: radio.dataset.title
        });
        writeLog(`dataset 選択: ${radio.dataset.title}`);
      });
    });

    const first = radios[0];
    if (first) {
      setSelectedDataset({
        dataset_id: first.dataset.datasetId,
        title: first.dataset.title
      });
      writeLog(`dataset 初期選択: ${first.dataset.title}`);
    }
  }

  function renderResources(items, writeLog) {
    const wrap = getResourceListEl();
    if (!wrap) return;

    if (!Array.isArray(items) || items.length === 0) {
      wrap.innerHTML = `<div class="placeholder">resource がありません</div>`;
      setSelectedResource(null);
      return;
    }

    wrap.innerHTML = items.map((item, idx) => {
      const allowedText = item.allowed ? "対象" : "対象外";
      return `
        <label class="choice-item">
          <input
            type="radio"
            name="opendataResource"
            value="${escapeHtml(item.resource_id)}"
            data-resource-id="${escapeHtml(item.resource_id)}"
            data-resource-name="${escapeHtml(item.resource_name)}"
            ${idx === 0 ? "checked" : ""}
          />
          <span class="choice-main">
            <span class="choice-title">${escapeHtml(item.resource_name)}</span>
            <span class="choice-meta">
              resource_id: ${escapeHtml(item.resource_id)}<br>
              format: ${escapeHtml(item.format || "-")} /
              kind: ${escapeHtml(item.kind || "-")} /
              ${escapeHtml(allowedText)}
            </span>
          </span>
        </label>
      `;
    }).join("");

    const radios = wrap.querySelectorAll('input[name="opendataResource"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        setSelectedResource({
          resource_id: radio.dataset.resourceId,
          resource_name: radio.dataset.resourceName
        });
        writeLog(`resource 選択: ${radio.dataset.resourceName}`);
      });
    });

    const first = radios[0];
    if (first) {
      setSelectedResource({
        resource_id: first.dataset.resourceId,
        resource_name: first.dataset.resourceName
      });
      writeLog(`resource 初期選択: ${first.dataset.resourceName}`);
    }
  }

  async function fetchDatasets({ apiBase, idToken, writeLog }) {
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
    renderDatasets(data.datasets || [], writeLog);

    writeLog(`データセット取得完了: ${data.dataset_count ?? 0}件`);
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
    renderResources(data.resources || [], writeLog);

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
    fetchDatasets,
    fetchResources,
    registerResource,
    setSelectedDataset,
    setSelectedResource,
    clearResources
  };
})();
