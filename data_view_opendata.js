console.log("data_view_opendata.js loaded");

window.DataViewOpenData = (function () {
  let ctx = null;
  let currentParentRows = [];
  let currentChildRows = [];
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

  function formatDateTime(value) {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("ja-JP");
    } catch (_) {
      return String(value);
    }
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
      rowEl.classList.toggle("selected-row", rowIndex === selectedParentIndex);
    });
  }

  async function downloadFileByFileId(fileRow) {
    const fileId = fileRow?.file_id;
    if (!fileId) {
      throw new Error("file_id がありません。");
    }

    const token = sessionStorage.getItem("idToken");
    if (!token) {
      throw new Error("ログイン情報が見つかりません。");
    }

    const url = `${ctx.apiBase}/opendata/download_url?file_id=${encodeURIComponent(fileId)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "ダウンロードに失敗しました。");
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileRow?.original_name || `${fileId}.${fileRow?.ext || "dat"}`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(blobUrl);
  }

  function clearChildArea(message = "") {
    currentChildRows = [];

    if (ctx?.childTableHead) ctx.childTableHead.innerHTML = "";
    if (ctx?.childTableBody) {
      if (message) {
        ctx.childTableBody.innerHTML = `
          <tr class="placeholder-row">
            <td colspan="5">${escapeHtml(message)}</td>
          </tr>
        `;
      } else {
        ctx.childTableBody.innerHTML = "";
      }
    }
    if (ctx?.detailPre) ctx.detailPre.textContent = message || "";
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

  function bindChildDownloadEvents() {
    if (!ctx?.childTableBody) return;

    const buttons = ctx.childTableBody.querySelectorAll(".btn-download-child");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.stopPropagation();

        const index = Number(btn.dataset.index || "-1");
        const row = currentChildRows[index];
        if (!row) return;

        try {
          await downloadFileByFileId(row);
        } catch (e) {
          console.error(e);
          if (ctx.detailPre) {
            ctx.detailPre.textContent = e.message || "ダウンロードに失敗しました。";
          }
          alert(e.message || "ダウンロードに失敗しました");
        }
      });
    });
  }

  function bindParentRowEvents() {
    const rows = ctx.parentTableBody?.querySelectorAll(".parent-row") || [];

    rows.forEach((tr) => {
      tr.addEventListener("click", async (event) => {
        if (event.target.closest(".parent-check")) return;

        const index = Number(tr.dataset.index || "-1");
        const row = currentParentRows[index];
        if (!row) return;

        try {
          setSelectedParentRow(index);
          await loadChildren(row);
        } catch (e) {
          console.error(e);
          clearChildArea(e.message || "子一覧の取得に失敗しました。");
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
        <th class="narrow-cell">状態</th>
        <th class="narrow-cell">子件数</th>
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
      const status = String(row.status || "");
      const childCount = Number(row.child_count || 0);

      return `
        <tr class="clickable-row parent-row" data-index="${index}">
          <td class="checkbox-cell">
            <input
              type="checkbox"
              class="parent-check"
              data-index="${index}"
            >
          </td>
          <td title="${escapeHtml(formatParentLabel(row))}">
            ${escapeHtml(formatParentLabel(row))}
          </td>
          <td>
            <span class="${escapeHtml(ctx.getStatusClass(status))}">
              ${escapeHtml(status || "new")}
            </span>
          </td>
          <td>${childCount}</td>
        </tr>
      `;
    }).join("");

    bindParentCheckboxEvents();
    bindParentRowEvents();
    syncParentCheckboxUi();
  }

  function renderChildTable(parentRow, files) {
    currentChildRows = Array.isArray(files) ? files : [];

    if (!ctx?.childTableHead || !ctx?.childTableBody) return;

    ctx.childTableHead.innerHTML = `
      <tr>
        <th>ファイル名</th>
        <th class="narrow-cell">ext</th>
        <th class="medium-cell">サイズ</th>
        <th class="medium-cell">作成日時</th>
        <th class="narrow-cell">DL</th>
      </tr>
    `;

    if (currentChildRows.length === 0) {
      ctx.childTableBody.innerHTML = `
        <tr class="placeholder-row">
          <td colspan="5">子ファイルがありません</td>
        </tr>
      `;
      return;
    }

    ctx.childTableBody.innerHTML = currentChildRows.map((row, index) => {
      return `
        <tr class="clickable-row child-row" data-index="${index}">
          <td title="${escapeHtml(row.original_name || "")}">
            ${escapeHtml(row.original_name || "")}
          </td>
          <td>${escapeHtml(row.ext || "")}</td>
          <td>${escapeHtml(Number(row.file_size || 0).toLocaleString())}</td>
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          <td>
            <button
              type="button"
              class="btn btn-primary btn-download-child"
              data-index="${index}"
            >
              DL
            </button>
          </td>
        </tr>
      `;
    }).join("");

    bindChildDownloadEvents();

    if (ctx.contextSummary) {
      ctx.contextSummary.textContent = `親一覧: ${formatParentLabel(parentRow)} / 子 ${currentChildRows.length} 件`;
    }

    if (ctx.detailPre) {
      ctx.detailPre.textContent =
        `source_id: ${parentRow.source_id ?? ""}\n` +
        `dataset_id: ${parentRow.dataset_id ?? ""}\n` +
        `title: ${parentRow.title ?? ""}\n` +
        `status: ${parentRow.status ?? ""}\n` +
        `child_count: ${parentRow.child_count ?? 0}\n` +
        `source_url: ${parentRow.source_url ?? ""}`;
    }
  }

  async function loadChildren(parentRow) {
    if (!parentRow?.source_id) {
      throw new Error("source_id がありません。");
    }

    clearChildArea("子一覧を読み込み中です...");

    const data = await ctx.apiGet("/opendata/document_files", {
      source_id: parentRow.source_id
    });

    const files = Array.isArray(data?.files) ? data.files : [];
    renderChildTable(parentRow, files);
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

  function applyKnowledgeStatus(statusData) {
    if (!Array.isArray(currentParentRows) || currentParentRows.length === 0) {
      return;
    }

    const jobStatus = String(statusData?.status || "").toLowerCase();
    if (!jobStatus) {
      return;
    }

    const checkedIndexes = Array.from(
      ctx.parentTableBody?.querySelectorAll(".parent-check:checked") || []
    ).map((el) => Number(el.dataset.index || "-1"));

    checkedIndexes.forEach((idx) => {
      if (currentParentRows[idx]) {
        currentParentRows[idx].status = jobStatus;
      }
    });

    if (selectedParentIndex >= 0 && currentParentRows[selectedParentIndex] && ctx?.detailPre) {
      const row = currentParentRows[selectedParentIndex];

      ctx.detailPre.textContent =
        `source_id: ${row.source_id ?? ""}\n` +
        `dataset_id: ${row.dataset_id ?? ""}\n` +
        `title: ${row.title ?? ""}\n` +
        `status: ${jobStatus}\n` +
        `child_count: ${row.child_count ?? 0}\n` +
        `source_url: ${row.source_url ?? ""}\n` +
        `phase: ${statusData?.phase ?? ""}\n` +
        `message: ${statusData?.message ?? ""}\n` +
        `chunk: ${statusData?.chunk_current ?? 0} / ${statusData?.chunk_total ?? 0}\n` +
        `qa_chunk: ${statusData?.qa_current ?? 0} / ${statusData?.qa_total ?? 0}\n` +
        `plain_chunk: ${statusData?.plain_current ?? 0} / ${statusData?.plain_total ?? 0}`;
    }

    renderParentTable(currentParentRows);

    if (selectedParentIndex >= 0) {
      setSelectedParentRow(selectedParentIndex);
    }

    checkedIndexes.forEach((idx) => {
      const check = ctx.parentTableBody?.querySelector(`.parent-check[data-index="${idx}"]`);
      if (check) {
        check.checked = true;
      }
    });

    syncParentCheckboxUi();
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
      child_count: row.child_count
    }));
  }

  return {
    init,
    loadParents,
    buildKnowledgeTargets,
    applyKnowledgeStatus
  };
})();
