console.log("data_view_upload.js loaded");

window.DataViewUpload = (() => {

let currentParentRows = [];
let currentChildRows = [];
let selectedParentIndex = -1;
let selectedChildIndex = -1;
let checkedParentIndexes = new Set();
let ctx = null;

function formatParentLabel(row) {
  return (
    row?.title ||
    row?.logical_name ||
    row?.original_name ||
    row?.file_id ||
    "(名称なし)"
  );
}

function formatChildTitle(row) {
  return (
    row?.source_item_id ||
    row?.row_index ||
    row?.row_id ||
    "(名称なし)"
  );
}

function parseRowContent(row) {
  const raw = row?.content || row?.text || row?.body || row?.detail || "";

  if (row?.data && typeof row.data === "object") {
    return row.data;
  }

  if (typeof raw === "object" && raw !== null) {
    return raw;
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return raw;
    }
  }

  return raw;
}

function formatChildContent(row) {
  const parsed = parseRowContent(row);

  if (parsed && typeof parsed === "object") {
    if (parsed.data && typeof parsed.data === "object") {
      try {
        return JSON.stringify(parsed.data, null, 2);
      } catch (_) {}
    }

    try {
      return JSON.stringify(parsed, null, 2);
    } catch (_) {
      return String(parsed);
    }
  }

  return String(parsed || "");
}

function extractRowsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.children)) return data.children;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function updateCheckedSummary() {
  if (ctx.selectionSummary) {
    ctx.selectionSummary.textContent = `選択 ${checkedParentIndexes.size} 件`;
  }

  if (ctx.btnKnowledge) {
    ctx.btnKnowledge.disabled = checkedParentIndexes.size === 0;
  }
}

function syncParentCheckboxUi() {
  if (!ctx?.parentTableBody) return;

  const checkboxes = ctx.parentTableBody.querySelectorAll(".parent-check");
  checkboxes.forEach((checkbox) => {
    const index = Number(checkbox.dataset.index || "-1");
    checkbox.checked = checkedParentIndexes.has(index);
  });
}

function bindParentCheckboxEvents() {
  if (!ctx?.parentTableBody) return;

  const checkboxes = ctx.parentTableBody.querySelectorAll(".parent-check");

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const index = Number(checkbox.dataset.index || "-1");
      if (index < 0) return;

      if (checkbox.checked) {
        checkedParentIndexes.add(index);
      } else {
        checkedParentIndexes.delete(index);
      }

      updateCheckedSummary();
      event.stopPropagation();
    });
  });
}

function clearChildArea(message = "親一覧から1件選択してください。") {
  currentChildRows = [];
  selectedChildIndex = -1;

  if (ctx.childTableHead) {
    ctx.childTableHead.innerHTML = "";
  }

  if (ctx.childTableBody) {
    ctx.childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>${ctx.escapeHtml(message)}</td>
      </tr>
    `;
  }
}

function renderDetailFromChild(row, parentRow) {
  const parsed = parseRowContent(row);
  const lines = [
    `file: ${formatParentLabel(parentRow)}`,
    `file_id: ${parentRow?.file_id ?? ""}`,
    `logical_name: ${parentRow?.logical_name ?? ""}`,
    `original_name: ${parentRow?.original_name ?? ""}`,
    `ext: ${parentRow?.ext ?? ""}`,
    `row_index: ${row?.row_index ?? ""}`,
    `source_item_id: ${row?.source_item_id ?? ""}`,
    ""
  ];

  if (parsed && typeof parsed === "object") {
    try {
      lines.push(JSON.stringify(parsed, null, 2));
    } catch (_) {
      lines.push(String(parsed));
    }
  } else {
    lines.push(formatChildContent(row) || formatChildTitle(row) || "詳細データがありません。");
  }

  if (ctx.detailPre) {
    ctx.detailPre.textContent = lines.join("\n");
  }
}

function setSelectedParentRow(index) {
  selectedParentIndex = index;

  const rows = ctx.parentTableBody.querySelectorAll(".parent-row");
  rows.forEach((el, i) => {
    el.classList.toggle("selected-row", i === index);
  });
}

function setSelectedChildRow(index) {
  selectedChildIndex = index;

  const rows = ctx.childTableBody.querySelectorAll(".child-row");
  rows.forEach((el, i) => {
    el.classList.toggle("selected-row", i === index);
  });
}

function bindChildRowEvents() {
  const rows = ctx.childTableBody.querySelectorAll(".child-row");

  rows.forEach((tr) => {
    tr.addEventListener("click", () => {
      const index = Number(tr.dataset.index || "-1");
      const row = currentChildRows[index];
      const parentRow = currentParentRows[selectedParentIndex];

      if (!row) return;

      setSelectedChildRow(index);
      renderDetailFromChild(row, parentRow);
    });
  });
}

function renderChildTable(rows, parentRow) {
  currentChildRows = Array.isArray(rows) ? rows : [];
  selectedChildIndex = -1;

  if (!Array.isArray(rows) || rows.length === 0) {
    clearChildArea("子データがありません。");

    if (ctx.contextSummary) {
      ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(parentRow)}`;
    }

    if (ctx.detailPre) {
      ctx.detailPre.textContent = `選択中: ${formatParentLabel(parentRow)}\n子データがありません。`;
    }

    return;
  }

  ctx.childTableHead.innerHTML = `
    <tr>
      <th class="narrow-cell">行</th>
      <th>内容</th>
    </tr>
  `;

  ctx.childTableBody.innerHTML = rows.map((row, index) => {
    const rowNo = row.row_index ?? index + 1;
    const title = formatChildTitle(row);
    const content = formatChildContent(row);
    const preview = content ? String(content).replace(/\s+/g, " ").slice(0, 80) : title;

    return `
      <tr class="clickable-row child-row" data-index="${index}">
        <td>${ctx.escapeHtml(rowNo)}</td>
        <td>${ctx.escapeHtml(preview)}</td>
      </tr>
    `;
  }).join("");

  bindChildRowEvents();

  if (ctx.contextSummary) {
    ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(parentRow)}`;
  }

  if (ctx.detailPre) {
    ctx.detailPre.textContent = `選択中: ${formatParentLabel(parentRow)}\n子一覧を表示しました。`;
  }
}

async function loadChildren(parentRow) {
  const fileId = parentRow?.file_id;

  if (!fileId) {
    throw new Error("file_id がありません。");
  }

  const data = await ctx.apiGet("/upload/rows", {
    file_id: fileId
  });

  const rows = extractRowsFromResponse(data);

  if (!Array.isArray(rows)) {
    throw new Error("子一覧データの形式が不正です。");
  }

  return rows;
}

function bindParentRowEvents() {
  const rows = ctx.parentTableBody.querySelectorAll(".parent-row");

  rows.forEach((tr) => {
    tr.addEventListener("click", async (event) => {
      if (event.target.closest(".parent-check")) {
        return;
      }

      const index = Number(tr.dataset.index || "-1");
      const row = currentParentRows[index];

      if (!row) return;

      setSelectedParentRow(index);
      clearChildArea("子一覧を読み込み中です...");

      if (ctx.contextSummary) {
        ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(row)}`;
      }

      if (ctx.detailPre) {
        ctx.detailPre.textContent =
          `選択中: ${formatParentLabel(row)}\n子一覧を読み込み中です...`;
      }

      try {
        const children = await loadChildren(row);
        renderChildTable(children, row);
      } catch (e) {
        console.error(e);
        clearChildArea(e.message || "子一覧の読み込みに失敗しました。");
        if (ctx.detailPre) {
          ctx.detailPre.textContent = e.message || "子一覧の読み込みに失敗しました。";
        }
      }
    });
  });
}

function renderParentTable(rows) {
  const filteredRows = Array.isArray(rows) ? rows : [];

  currentParentRows = filteredRows;
  currentChildRows = [];
  selectedParentIndex = -1;
  selectedChildIndex = -1;
  checkedParentIndexes = new Set();

  if (filteredRows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    clearChildArea("親一覧から1件選択してください。");

    if (ctx.summaryText) ctx.summaryText.textContent = "0 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: アップロード";
    if (ctx.detailPre) ctx.detailPre.textContent = "データがありません。";

    updateCheckedSummary();
    return;
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th class="checkbox-cell"></th>
      <th>ファイル</th>
      <th class="narrow-cell">件数</th>
      <th class="narrow-cell">ext</th>
    </tr>
  `;

  ctx.parentTableBody.innerHTML = filteredRows.map((row, index) => {
    return `
      <tr class="clickable-row parent-row" data-index="${index}">
        <td class="checkbox-cell">
          <input
            type="checkbox"
            class="parent-check"
            data-index="${index}"
          >
        </td>
        <td>${ctx.escapeHtml(formatParentLabel(row))}</td>
        <td>${ctx.escapeHtml(row.row_count ?? "")}</td>
        <td>${ctx.escapeHtml(row.ext ?? "")}</td>
      </tr>
    `;
  }).join("");

  bindParentCheckboxEvents();
  bindParentRowEvents();
  syncParentCheckboxUi();

  clearChildArea("親一覧から1件選択してください。");

  if (ctx.summaryText) ctx.summaryText.textContent = `${filteredRows.length} 件`;
  if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: アップロード";
  if (ctx.detailPre) ctx.detailPre.textContent = "親一覧を表示しました。";

  updateCheckedSummary();
}

async function load(viewContext) {
  ctx = viewContext;

  currentParentRows = [];
  currentChildRows = [];
  selectedParentIndex = -1;
  selectedChildIndex = -1;
  checkedParentIndexes = new Set();

  clearChildArea("親一覧から1件選択してください。");

  try {
    ctx.renderParentPlaceholder("親一覧を読み込み中です...");

    if (ctx.detailPre) {
      ctx.detailPre.textContent = "アップロードの親一覧を読み込み中です...";
    }

    const data = await ctx.apiGet("/upload/files");
    const rows = Array.isArray(data.files) ? data.files : [];

    renderParentTable(rows);
  } catch (e) {
    console.error(e);
    ctx.renderParentPlaceholder(e.message || "親一覧の読み込みに失敗しました。");
    clearChildArea("親一覧から1件選択してください。");

    if (ctx.detailPre) {
      ctx.detailPre.textContent = e.message || "親一覧の読み込みに失敗しました。";
    }
  }
}

function getCheckedRows() {
  return Array.from(checkedParentIndexes)
    .sort((a, b) => a - b)
    .map((index) => currentParentRows[index])
    .filter(Boolean);
}

function checkAll() {
  checkedParentIndexes = new Set(
    currentParentRows.map((_, index) => index)
  );
  syncParentCheckboxUi();
  updateCheckedSummary();
}

function clearAllChecks() {
  checkedParentIndexes = new Set();
  syncParentCheckboxUi();
  updateCheckedSummary();
}

return {
  load,
  getCheckedRows,
  checkAll,
  clearAllChecks
};

})();
