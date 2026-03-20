console.log("data_view_opendata.js loaded");

window.DataViewOpenData = (function () {
  let ctx = null;
  let currentParentRows = [];
  let selectedParentIndex = -1;

  function init(context) {
    ctx = context;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatParentLabel(row) {
    return row?.title || row?.logical_name || row?.original_name || row?.source_id || "(名称なし)";
  }

  function clearChildArea(message = "") {
    if (ctx?.childTableHead) ctx.childTableHead.innerHTML = "";
    if (ctx?.childTableBody) ctx.childTableBody.innerHTML = "";
    if (ctx?.detailPre) ctx.detailPre.textContent = message || "";
  }

  function updateSelectedCount() {
    if (!ctx?.selectedCountEl) return;
    const count = Array.from(ctx.parentTableBody?.querySelectorAll(".parent-check:checked") || []).length;
    ctx.selectedCountEl.textContent = `選択 ${count} 件`;
  }

  function syncParentCheckboxUi() {
    updateSelectedCount();
  }

  function setSelectedParentRow(index) {
    selectedParentIndex = index;
    const rows = ctx.parentTableBody?.querySelectorAll(".parent-row") || [];
    rows.forEach((rowEl) => {
      const rowIndex = Number(rowEl.dataset.index || "-1");
      rowEl.classList.toggle("selected", rowIndex === selectedParentIndex);
    });
  }

  async function downloadSourceFile(parentRow) {
    const sourceId = parentRow?.source_id;
    if (!sourceId) {
      throw new Error("source_id がありません。");
    }

    const data = await ctx.apiGet("/opendata/download_url", {
      source_id: sourceId
    });

    const url = data?.download_url;
    if (!url) {
      throw new Error("download_url が取得できませんでした。");
    }

    window.open(url, "_blank");
  }

  function bindParentCheckboxEvents() {
    const checks = ctx.parentTableBody?.querySelectorAll(".parent-check") || [];
    checks.forEach((input) => {
      input.addEventListener("change", () => {
        syncParentCheckboxUi();
      });
    });

    if (ctx.btnCheckAll) {
      ctx.btnCheckAll.onclick = () => {
        const targets = ctx.parentTableBody?.querySelectorAll(".parent-check") || [];
        targets.forEach((el) => {
          el.checked = true;
        });
        syncParentCheckboxUi();
      };
    }

    if (ctx.btnClearChecks) {
      ctx.btnClearChecks.onclick = () => {
        const targets = ctx.parentTableBody?.querySelectorAll(".parent-check") || [];
        targets.forEach((el) => {
          el.checked = false;
        });
        syncParentCheckboxUi();
      };
    }
  }

  function bindDownloadEvents() {
    if (!ctx?.parentTableBody) return;

    const buttons = ctx.parentTableBody.querySelectorAll(".btn-download");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.stopPropagation();

        const index = Number(btn.dataset.index || "-1");
        const row = currentParentRows[index];
        if (!row) return;

        try {
          await downloadSourceFile(row);
        } catch (e) {
          console.error(e);
          if (ctx.detailPre) {
            ctx.detailPre.textContent = e.message || "ダウンロードURLの取得に失敗しました。";
          }
          alert(e.message || "ダウンロードURLの取得に失敗しました");
        }
      });
    });
  }

  function bindParentRowEvents() {
    const rows = ctx.parentTableBody?.querySelectorAll(".parent-row") || [];

    rows.forEach((tr) => {
      tr.addEventListener("click", async (event) => {
        if (event.target.closest(".parent-check")) return;
        if (event.target.closest(".btn-download")) return;

        const index = Number(tr.dataset.index || "-1");
        const row = currentParentRows[index];
        if (!row) return;

        setSelectedParentRow(index);
        clearChildArea("このデータはファイル保存方式です。ダウンロードボタンを使ってください。");

        if (ctx.contextSummary) {
          ctx.contextSummary.textContent = `親一覧: ${formatParentLabel(row)}`;
        }

        if (ctx.detailPre) {
          ctx.detailPre.textContent =
            `source_id: ${row.source_id ?? ""}\n` +
            `dataset_id: ${row.dataset_id ?? ""}\n` +
            `title: ${row.title ?? ""}\n` +
            `ext: ${row.ext ?? ""}\n` +
            `status: ${row.status ?? ""}\n` +
            `source_url: ${row.source_url ?? ""}\n` +
            `original_name: ${row.original_name ?? ""}`;
        }
      });
    });
  }

  function renderParentTable(rows) {
    currentParentRows = Array.isArray(rows) ? rows : [];
    selectedParentIndex = -1;

    if (!ctx?.parentTableHead || !ctx?.parentTableBody) return;

    ctx.parentTableHead.innerHTML = `
      <tr>
        <th class="checkbox-cell"></th>
        <th>データセット</th>
        <th class="narrow-cell">ext</th>
        <th class="narrow-cell">ダウンロード</th>
      </tr>
    `;

    if (currentParentRows.length === 0) {
      ctx.parentTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="muted">データがありません</td>
        </tr>
      `;
      clearChildArea("");
      syncParentCheckboxUi();
      return;
    }

    ctx.parentTableBody.innerHTML = currentParentRows.map((row, index) => {
      return `
        <tr class="clickable-row parent-row" data-index="${index}">
          <td class="checkbox-cell">
            <input
              type="checkbox"
              class="parent-check"
              data-index="${index}"
            >
          </td>
          <td>${escapeHtml(formatParentLabel(row))}</td>
          <td>${escapeHtml(row.ext ?? "")}</td>
          <td>
            ${
              String(row.status || "").toLowerCase() === "done"
                ? `
                  <button
                    type="button"
                    class="btn btn-secondary btn-download"
                    data-index="${index}"
                  >
                    DL
                  </button>
                `
                : `<span class="muted">-</span>`
            }
          </td>
        </tr>
      `;
    }).join("");

    bindParentCheckboxEvents();
    bindParentRowEvents();
    bindDownloadEvents();
    syncParentCheckboxUi();
  }

  async function loadParents() {
    clearChildArea("");
    if (ctx?.contextSummary) {
      ctx.contextSummary.textContent = "";
    }

    const data = await ctx.apiGet("/opendata/documents");
    const rows = Array.isArray(data?.datasets) ? data.datasets : [];

    if (ctx?.parentCountEl) {
      ctx.parentCountEl.textContent = `${rows.length} 件`;
    }

    renderParentTable(rows);
  }

  async function buildKnowledgeTargets() {
    const checks = Array.from(ctx.parentTableBody?.querySelectorAll(".parent-check:checked") || []);
    const selected = checks
      .map((el) => {
        const index = Number(el.dataset.index || "-1");
        return currentParentRows[index];
      })
      .filter(Boolean);

    return selected.map((row) => ({
      source_id: row.source_id,
      source_type: "opendata",
      title: row.title,
      ext: row.ext
    }));
  }

  return {
    init,
    loadParents,
    buildKnowledgeTargets
  };
})();
