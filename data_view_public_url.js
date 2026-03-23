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

  function normalizeDecision(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatDecisionLabel(value) {
    const s = normalizeDecision(value);
    if (s === "pass") return "採用";
    if (s === "reject") return "除外";
    return value || "";
  }

  function formatUsableLabel(value) {
    return Number(value) === 1 ? "採用" : "対象外";
  }

  function renderDecisionChip(value) {
    const s = normalizeDecision(value);
    const label = formatDecisionLabel(value);

    if (s === "pass") {
      return `<span class="url-chip pass">採用</span>`;
    }
    if (s === "reject") {
      return `<span class="url-chip reject">除外</span>`;
    }
    return `<span class="url-chip">${escapeHtml(label || "")}</span>`;
  }

  function renderUsableChip(value) {
    if (Number(value) === 1) {
      return `<span class="url-chip usable">採用</span>`;
    }
    return `<span class="url-chip unusable">対象外</span>`;
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
            <td colspan="7">${escapeHtml(message)}</td>
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

  async function decomposePage(pageRow) {
    const pageUrl = pageRow?.page_url;
    if (!pageUrl) {
      throw new Error("page_url がありません。");
    }

    return await ctx.apiPost("/public-url/decompose", {
      page_url: pageUrl
    });
  }

  function canDecompose(row) {
    if (!row) return false;
    if (Number(row.is_usable) !== 1) return false;

    const status = normalizeStatus(row.status);
    if (status === "done") return false;
    if (status === "fetch_error") return false;

    return true;
  }

  function bindChildActionEvents(parentRow) {
    if (!ctx?.childTableBody) return;

    const buttons = ctx.childTableBody.querySelectorAll(".btn-decompose-child");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.stopPropagation();

        const index = Number(btn.dataset.index || "-1");
        const row = currentChildRows[index];
        if (!row) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "分解中";

        try {
          const result = await decomposePage(row);
          row.status = "done";

          if (ctx.detailPre) {
            ctx.detailPre.textContent =
              `page_id: ${result?.page_id ?? row.page_id ?? ""}\n` +
              `page_url: ${result?.page_url ?? row.page_url ?? ""}\n` +
              `content_id: ${result?.content_id ?? ""}\n` +
              `content_length: ${result?.content_length ?? 0}\n` +
              `message: ${result?.message ?? ""}`;
          }

          renderChildTable(parentRow, currentChildRows);
        } catch (e) {
          console.error(e);
          if (ctx.detailPre) {
            ctx.detailPre.textContent = e.message || "分解に失敗しました。";
          }
          alert(e.message || "分解に失敗しました");
          btn.disabled = false;
          btn.textContent = originalText;
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

  function renderChildTable(parentRow, rows) {
    currentChildRows = Array.isArray(rows) ? rows : [];

    if (!ctx?.childTableHead || !ctx?.childTableBody) return;

    ctx.childTableHead.innerHTML = `
      <tr>
        <th>depth</th>
        <th>判定</th>
        <th>採用</th>
        <th>状態</th>
        <th>作成日時</th>
        <th>URL</th>
        <th>操作</th>
      </tr>
    `;

    if (currentChildRows.length === 0) {
      ctx.childTableBody.innerHTML = `
        <tr class="placeholder-row">
          <td colspan="7">子URLがありません</td>
        </tr>
      `;
      return;
    }

    ctx.childTableBody.innerHTML = currentChildRows.map((row, index) => {
      const pageUrl = row.page_url || "";
      const actionHtml = canDecompose(row)
        ? `
          <button
            type="button"
            class="btn btn-primary btn-decompose-child"
            data-index="${index}"
          >
            分解
          </button>
        `
        : `<span class="job-state-text state-waiting">分解済</span>`;

      return `
        <tr class="clickable-row child-row" data-index="${index}">
          <td>${escapeHtml(row.depth ?? "")}</td>
          <td>${renderDecisionChip(row.decision || "")}</td>
          <td>${renderUsableChip(row.is_usable)}</td>
          <td>${renderStatusChip(row.status)}</td>
          <td>${escapeHtml(formatDateTime(row.created_at || row.fetched_at))}</td>
          <td title="${escapeHtml(pageUrl)}">
            <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(pageUrl)}
            </a>
          </td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join("");

    bindChildActionEvents(parentRow);

    if (ctx.contextSummary) {
      ctx.contextSummary.textContent = `親一覧: ${formatParentLabel(parentRow)} / 子 ${currentChildRows.length} 件`;
    }

    if (ctx.detailPre) {
      ctx.detailPre.textContent =
        `root_id: ${parentRow.root_id ?? ""}\n` +
        `source_type: ${parentRow.source_type ?? ""}\n` +
        `root_url: ${parentRow.root_url ?? ""}\n` +
        `title: ${parentRow.title ?? ""}\n` +
        `status: ${parentRow.status ?? ""}\n` +
        `child_count: ${parentRow.child_count ?? parentRow.page_count ?? 0}`;
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
