console.log("data_view_opendata.js loaded");

window.DataViewOpenData = (() => {

let currentParentRows = [];
let currentChildRows = [];
let selectedParentIndex = -1;
let selectedChildIndex = -1;
let checkedParentIndexes = new Set();
let ctx = null;

function formatParentLabel(row) {
  return (
    row?.title ||
    row?.dataset_id ||
    row?.source_id ||
    "(名称なし)"
  );
}

function formatChildTitle(row) {
  return (
    row?.resource_name ||
    row?.source_item_id ||
    row?.row_index ||
    "(名称なし)"
  );
}

function formatChildContent(row) {
  if (row?.data && typeof row.data === "object") {
    try {
      return JSON.stringify(row.data, null, 2);
    } catch (_) {}
  }

  return (
    row?.content ||
    row?.text ||
    row?.body ||
    row?.detail ||
    ""
  );
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
  const lines = [
    `dataset: ${formatParentLabel(parentRow)}`,
    `dataset_id: ${parentRow?.dataset_id ?? ""}`,
    `source_id: ${parentRow?.source_id ?? ""}`,
    `row_index: ${row?.row_index ?? ""}`,
    `source_item_id: ${row?.source_item_id ?? ""}`,
    "",
    formatChildContent(row) || formatChildTitle(row) || "詳細データがありません。"
  ];

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
    const preview = content ? String(content).slice(0, 80) : title;

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
}

async function expandDataset(parentRow) {
  const datasetId = parentRow?.dataset_id;
  if (!datasetId) {
    throw new Error("dataset_id がありません。");
  }

  const data = await ctx.apiPost("/opendata/expand_dataset", null, {
    dataset_id: datasetId
  });

  return data;
}

async function loadChildren(parentRow) {
  const expandResult = await expandDataset(parentRow);

  const sourceId =
    expandResult?.source_id ||
    parentRow?.source_id;

  if (!sourceId) {
    throw new Error("展開後の source_id が取得できません。");
  }

  const data = await ctx.apiGet("/row_data/rows", {
    source_type: "opendata",
    file_id: sourceId
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
      clearChildArea("データ展開・子一覧を読み込み中です...");

      if (ctx.contextSummary) {
        ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(row)}`;
      }

      if (ctx.detailPre) {
        ctx.detailPre.textContent =
          `選択中: ${formatParentLabel(row)}\nデータ展開・子一覧を読み込み中です...`;
      }

      try {
        const children = await loadChildren(row);
        renderChildTable(children, row);

        if (ctx.detailPre) {
          ctx.detailPre.textContent =
            `選択中: ${formatParentLabel(row)}\n子一覧を表示しました。`;
        }
      } catch (e) {
        console.error(e);
        clearChildArea(e.message);
        if (ctx.detailPre) {
          ctx.detailPre.textContent = e.message;
        }
      }
    });
  });
}

function renderParentTable(rows) {
  const filteredRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row?.status || "").toLowerCase() === "done"
  );

  currentParentRows = filteredRows;
  currentChildRows = [];
  selectedParentIndex = -1;
  selectedChildIndex = -1;
  checkedParentIndexes = new Set();

  if (filteredRows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    clearChildArea("親一覧から1件選択してください。");

    if (ctx.summaryText) ctx.summaryText.textContent = "0 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: オープンデータ";
    if (ctx.detailPre) ctx.detailPre.textContent = "データがありません。";

    updateCheckedSummary();
    return;
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th class="checkbox-cell"></th>
      <th>データセット</th>
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
  if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: オープンデータ";
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
      ctx.detailPre.textContent = "オープンデータの親一覧を読み込み中です...";
    }

    const data = await ctx.apiGet("/opendata/fetch_datasets");
    const rows = Array.isArray(data.datasets) ? data.datasets : [];

    renderParentTable(rows);
  } catch (e) {
    console.error(e);
    ctx.renderParentPlaceholder(e.message);
    clearChildArea("親一覧から1件選択してください。");

    if (ctx.detailPre) {
      ctx.detailPre.textContent = e.message;
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
