console.log("data_source_opendata.js loaded");

(function () {
  const PAGE_SIZE = 5;

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
    if (!datasetList) return;

    datasetList.__pagerState = {
      currentPage: 1,
      pageSize: PAGE_SIZE,
      allItems: []
    };

    datasetList.innerHTML = `<div class="placeholder">まだ取得していません</div>`;
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

  function cloneItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({ ...item }));
  }

  function updateItemStatusLocally(items, datasetId, nextStatus, nextExt, nextOriginalName) {
    return cloneItems(items).map((item) => {
      if (String(item.dataset_id ?? "") !== String(datasetId ?? "")) {
        return { ...item };
      }

      return {
        ...item,
        status: nextStatus,
        ext: nextExt ?? item.ext,
        original_name: nextOriginalName ?? item.original_name
      };
    });
  }

  function ensurePagerState(targetEl, items) {
    if (!targetEl) {
      return {
        currentPage: 1,
        pageSize: PAGE_SIZE,
        allItems: []
      };
    }

    if (!targetEl.__pagerState) {
      targetEl.__pagerState = {
        currentPage: 1,
        pageSize: PAGE_SIZE,
        allItems: []
      };
    }

    if (Array.isArray(items)) {
      targetEl.__pagerState.allItems = cloneItems(items);
    }

    if (!targetEl.__pagerState.pageSize || targetEl.__pagerState.pageSize < 1) {
      targetEl.__pagerState.pageSize = PAGE_SIZE;
    }

    const totalPages = Math.max(
      1,
      Math.ceil((targetEl.__pagerState.allItems.length || 0) / targetEl.__pagerState.pageSize)
    );

    if (!targetEl.__pagerState.currentPage || targetEl.__pagerState.currentPage < 1) {
      targetEl.__pagerState.currentPage = 1;
    }

    if (targetEl.__pagerState.currentPage > totalPages) {
      targetEl.__pagerState.currentPage = totalPages;
    }

    return targetEl.__pagerState;
  }

  function buildDatasetRow(item, indexOnPage, offset) {
    const rowNo = offset + indexOnPage + 1;
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
          ${rowNo}. ${escapeHtml(title)}
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

  function buildPagerHtml(currentPage, totalPages, totalCount) {
    const prevDisabled = currentPage <= 1 ? "disabled" : "";
    const nextDisabled = currentPage >= totalPages ? "disabled" : "";

    return `
      <div class="url-pager">
        <div class="url-pager-info">
          ${escapeHtml(totalCount)}件 / ${escapeHtml(currentPage)} / ${escapeHtml(totalPages)}ページ
        </div>
        <div class="url-pager-actions">
          <button type="button" class="btn btn-primary btn-opendata-page-prev" ${prevDisabled}>前へ</button>
          <button type="button" class="btn btn-primary btn-opendata-page-next" ${nextDisabled}>次へ</button>
        </div>
      </div>
    `;
  }

  function renderDatasets(items, handlers, writeLog) {
    const wrap = getDatasetListEl();
    if (!wrap) return;

    const state = ensurePagerState(wrap, items);
    const allItems = Array.isArray(state.allItems) ? state.allItems : [];

    if (allItems.length === 0) {
      wrap.innerHTML = `<div class="placeholder">データセットがありません</div>`;
      return;
    }

    const totalCount = allItems.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize));
    const currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);
    const startIndex = (currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const visibleItems = allItems.slice(startIndex, endIndex);

    const rowsHtml = visibleItems
      .map((item, i) => buildDatasetRow(item, i, startIndex))
      .join("");

    const pagerHtml = buildPagerHtml(currentPage, totalPages, totalCount);

    wrap.innerHTML = `
      <div class="opendata-list">${rowsHtml}</div>
      ${pagerHtml}
    `;

    const prevBtn = wrap.querySelector(".btn-opendata-page-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (state.currentPage <= 1) return;
        state.currentPage -= 1;
        renderDatasets(null, handlers, writeLog);
      });
    }

    const nextBtn = wrap.querySelector(".btn-opendata-page-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (state.currentPage >= totalPages) return;
        state.currentPage += 1;
        renderDatasets(null, handlers, writeLog);
      });
    }

    const buttons = wrap.querySelectorAll(".btn-dataset-expand");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const datasetId = btn.dataset.datasetId;
        const datasetTitle = btn.dataset.datasetTitle;
        const originalText = btn.textContent;

        btn.disabled = true;
        btn.textContent = "取得中";

        try {
          const data = await handlers.onExpandDataset(datasetId, datasetTitle);

          state.allItems = updateItemStatusLocally(
            state.allItems,
            datasetId,
            "done",
            data?.ext,
            data?.original_name
          );

          renderDatasets(null, handlers, writeLog);
        } catch (e) {
          console.error(e);
          writeLog(`dataset 取得失敗: ${e.message}`);
          btn.disabled = false;
          btn.textContent = originalText;
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
