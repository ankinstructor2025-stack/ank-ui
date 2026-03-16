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

function clearChildArea(message = "親一覧から1件選択してください。") {
  currentChildRows = [];
  selectedChildIndex = -1;

  if (ctx.childTableHead) ctx.childTableHead.innerHTML = "";

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
    formatChildContent(row)
  ];

  ctx.detailPre.textContent = lines.join("\n");
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

    const content = formatChildContent(row);

    const preview = content ? String(content).slice(0, 80) : "";

    return `
<tr class="clickable-row child-row" data-index="${index}">
<td>${ctx.escapeHtml(rowNo)}</td>
<td>${ctx.escapeHtml(preview)}</td>
</tr>
`;

  }).join("");

  bindChildRowEvents();

}

async function expandDataset(parentRow) {

  const datasetId = parentRow?.dataset_id;

  const data = await ctx.apiPost("/opendata/expand_dataset", {
    dataset_id: datasetId
  });

  return data;

}

async function loadChildren(parentRow) {

  const expandResult = await expandDataset(parentRow);

  const sourceId = expandResult?.source_id || parentRow?.source_id;

  const data = await ctx.apiGet("/row_data/rows", {
    source_type: "opendata",
    file_id: sourceId
  });

  const rows = extractRowsFromResponse(data);

  return rows;

}

function bindParentRowEvents() {

  const rows = ctx.parentTableBody.querySelectorAll(".parent-row");

  rows.forEach((tr) => {

    tr.addEventListener("click", async () => {

      const index = Number(tr.dataset.index || "-1");

      const row = currentParentRows[index];

      if (!row) return;

      setSelectedParentRow(index);

      clearChildArea("読み込み中...");

      try {

        const children = await loadChildren(row);

        renderChildTable(children, row);

      } catch (e) {

        console.error(e);

        clearChildArea(e.message);

      }

    });

  });

}

function renderParentTable(rows) {

  // ⭐ doneのみ表示
  rows = rows.filter(r => r.status === "done");

  currentParentRows = rows;

  if (!Array.isArray(rows) || rows.length === 0) {

    ctx.renderParentPlaceholder("データがありません");

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

  ctx.parentTableBody.innerHTML = rows.map((row, index) => {

    return `
<tr class="clickable-row parent-row" data-index="${index}">
<td class="checkbox-cell">
<input type="checkbox" class="parent-check" data-index="${index}">
</td>
<td>${ctx.escapeHtml(formatParentLabel(row))}</td>
<td>${ctx.escapeHtml(row.row_count ?? "")}</td>
<td>${ctx.escapeHtml(row.ext ?? "")}</td>
</tr>
`;

  }).join("");

  bindParentRowEvents();

  if (ctx.summaryText) ctx.summaryText.textContent = `${rows.length} 件`;

}

async function load(viewContext) {

  ctx = viewContext;

  try {

    ctx.renderParentPlaceholder("親一覧を読み込み中...");

    const data = await ctx.apiGet("/opendata/fetch_datasets");

    const rows = Array.isArray(data.datasets) ? data.datasets : [];

    renderParentTable(rows);

  } catch (e) {

    console.error(e);

    ctx.renderParentPlaceholder(e.message);

  }

}

function getCheckedRows() {

  return Array.from(checkedParentIndexes)

    .sort((a, b) => a - b)

    .map((index) => currentParentRows[index])

    .filter(Boolean);

}

return {

  load,

  getCheckedRows

};

})();
