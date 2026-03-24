console.log("data_view_public_url.js loaded");

window.DataViewPublicUrl = (function () {
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

  function formatParentLabel(row) {
    return row?.title || row?.root_url || row?.root_id || "(名称なし)";
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function renderStatusChip(value) {
    const s = normalizeStatus(value);
    const label = s || "new";

    if (s === "done") {
      return `<span class="job-status-chip status-done">done</span>`;
    }
    if (s === "running") {
      return `<span class="job-status-chip status-running">running</span>`;
    }
    if (s === "error" || s === "fetch_error") {
      return `<span class="job-status-chip status-error">${escapeHtml(label)}</span>`;
    }
    return `<span class="job-status-chip status-new">${escapeHtml(label)}</span>`;
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

  function clearChildArea(message = "") {
    currentChildRows = [];

    if (ctx?.childTableHead) ctx.childTableHead.innerHTML = "";
    if (ctx?.childTableBody) {
      if (message) {
        ctx.childTableBody.innerHTML = `
          <tr class="placeholder-row">
            <td colspan="4">${escapeHtml(message)}</td>
          </tr>
        `;
      } else {
        ctx.childTableBody.innerHTML = "";
      }
    }
    if (ctx?.detailPre) ctx.detailPre.textContent = message || "";
  }

  function getCheckedParentIndexes() {
    return Array.from(
      ctx.parentTableBody?.querySelectorAll(".parent-check:checked") || []
    ).map((el) => Number(el.dataset.index || "-1"));
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
        <th>ルートURL</th>
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
      const childCount = Number(row.child_count || row.page_count || 0);

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
          <td>${renderStatusChip(row.status)}</td>
          <td>${childCount}</td>
        </tr>
      `;
    }).join("");

    bindParentCheckboxEvents();
    bindParentRowEvents();
    syncParentCheckboxUi();
  }

  function renderChildTable(parentRow, allRows) {
    const rows = Array.isArray(allRows) ? allRows : [];
    const doneRows = rows.filter((row) => normalizeStatus(row.status) === "done");

    currentChildRows = doneRows;

    if (!ctx?.childTableHead || !ctx?.childTableBody) return;

    ctx.childTableHead.innerHTML = `
      <tr>
        <th>depth</th>
        <th>状態</th>
        <th>作成日時</th>
        <th>URL</th>
      </tr>
    `;

    if (doneRows.length === 0) {
      ctx.childTableBody.innerHTML = `
        <tr class="placeholder-row">
          <td colspan="4">分解済の子データがありません</td>
        </tr>
      `;
    } else {
      ctx.childTableBody.innerHTML = doneRows.map((row) => {
        const pageUrl = row.page_url || "";

        return `
          <tr class="clickable-row child-row">
            <td>${escapeHtml(row.depth ?? "")}</td>
            <td>${renderStatusChip(row.status)}</td>
            <td>${escapeHtml(formatDateTime(row.created_at || row.fetched_at))}</td>
            <td title="${escapeHtml(pageUrl)}">
              <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(pageUrl)}
              </a>
            </td>
          </tr>
        `;
      }).join("");
    }

    if (ctx.contextSummary) {
      ctx.contextSummary.textContent = `親一覧: ${formatParentLabel(parentRow)} / 分解済 ${doneRows.length} 件 / 全子 ${rows.length} 件`;
    }

    if (ctx.detailPre) {
      const doneCount = rows.filter((row) => normalizeStatus(row.status) === "done").length;
      const newCount = rows.filter((row) => normalizeStatus(row.status) === "new").length;
      const runningCount = rows.filter((row) => normalizeStatus(row.status) === "running").length;
      const errorCount = rows.filter((row) => {
        const s = normalizeStatus(row.status);
        return s === "error" || s === "fetch_error";
      }).length;

      ctx.detailPre.textContent =
        `root_id: ${parentRow.root_id ?? ""}\n` +
        `source_type: ${parentRow.source_type ?? ""}\n` +
        `root_url: ${parentRow.root_url ?? ""}\n` +
        `title: ${parentRow.title ?? ""}\n` +
        `status: ${parentRow.status ?? ""}\n` +
        `child_count: ${parentRow.child_count ?? parentRow.page_count ?? 0}\n` +
        `done_count: ${doneCount}\n` +
        `new_count: ${newCount}\n` +
        `running_count: ${runningCount}\n` +
        `error_count: ${errorCount}`;
    }
  }

  async function loadChildren(parentRow) {
    if (!parentRow?.root_id) {
      throw new Error("root_id がありません。");
    }

    clearChildArea("子一覧を読み込み中です...");

    const data = await ctx.apiGet("/public-url/pages", {
      root_id: parentRow.root_id
    });

    const rows = Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.pages)
        ? data.pages
        : [];

    renderChildTable(parentRow, rows);
  }

  async function loadParents() {
    clearChildArea("");
    if (ctx?.contextSummary) {
      ctx.contextSummary.textContent = "";
    }

    const data = await ctx.apiGet("/public-url/roots", {
      source_key: ctx.currentSourceKey
    });

    const rows = Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.roots)
        ? data.roots
        : [];

    if (ctx?.parentCountEl) {
      ctx.parentCountEl.textContent = `${rows.length} 件`;
    }

    renderParentTable(rows);
  }

  function applyKnowledgeStatus(statusData) {
    if (!Array.isArray(currentParentRows) || currentParentRows.length === 0) {
      return;
    }

    const jobStatus = normalizeStatus(statusData?.status);
    if (!jobStatus) {
      return;
    }

    const checkedIndexes = getCheckedParentIndexes();

    checkedIndexes.forEach((idx) => {
      if (currentParentRows[idx]) {
        currentParentRows[idx].status = jobStatus;
      }
    });

    if (selectedParentIndex >= 0 && currentParentRows[selectedParentIndex] && ctx?.detailPre) {
      const row = currentParentRows[selectedParentIndex];

      ctx.detailPre.textContent =
        `root_id: ${row.root_id ?? ""}\n` +
        `source_type: ${row.source_type ?? ""}\n` +
        `root_url: ${row.root_url ?? ""}\n` +
        `status: ${jobStatus}\n` +
        `child_count: ${row.child_count ?? row.page_count ?? 0}\n` +
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
      root_id: row.root_id,
      source_type: "public_url",
      source_key: row.source_key || row.source_type || ctx.currentSourceKey,
      title: row.title || row.root_url,
      child_count: row.child_count || row.page_count || 0
    }));
  }

  return {
    init,
    loadParents,
    buildKnowledgeTargets,
    applyKnowledgeStatus
  };
})();
