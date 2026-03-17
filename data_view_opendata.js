console.log("data_view_opendata.js loaded");

window.DataViewOpenData = (() => {

let currentParentRows = [];
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

function clearChildArea(message = "オープンデータは一覧表示のみです。") {
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

function renderParentTable(rows) {
  const filteredRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row?.status || "").toLowerCase() === "done"
  );

  currentParentRows = filteredRows;
  checkedParentIndexes = new Set();

  if (filteredRows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    clearChildArea("オープンデータは一覧表示のみです。");

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
      <tr data-index="${index}">
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
  syncParentCheckboxUi();

  clearChildArea("オープンデータは一覧表示のみです。");

  if (ctx.summaryText) ctx.summaryText.textContent = `${filteredRows.length} 件`;
  if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: オープンデータ";
  if (ctx.detailPre) {
    ctx.detailPre.textContent = "オープンデータはテーブル参照のみです。外部サイトへの再取得は行いません。";
  }

  updateCheckedSummary();
}

async function load(viewContext) {
  ctx = viewContext;

  currentParentRows = [];
  checkedParentIndexes = new Set();

  clearChildArea("オープンデータは一覧表示のみです。");

  try {
    ctx.renderParentPlaceholder("親一覧を読み込み中です...");

    if (ctx.detailPre) {
      ctx.detailPre.textContent = "オープンデータの親一覧を読み込み中です...";
    }

    const data = await ctx.apiGet("/opendata/documents");
    const rows = Array.isArray(data.datasets) ? data.datasets : [];

    renderParentTable(rows);
  } catch (e) {
    console.error(e);
    ctx.renderParentPlaceholder(e.message);
    clearChildArea("オープンデータは一覧表示のみです。");

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
