console.log("data_view_kokkai.js loaded");

window.DataViewKokkai = (() => {

let currentParentRows = [];
let currentChildRows = [];
let selectedParentIndex = -1;
let selectedChildIndex = -1;
let checkedParentIndexes = new Set();
let ctx = null;

function formatParentLabel(row) {
  const house = row?.name_of_house || "";
  const meeting = row?.name_of_meeting || "";
  return [house, meeting].filter(Boolean).join(" / ");
}

function formatChildTitle(row) {
  return (
    row?.title ||
    row?.question ||
    row?.headline ||
    row?.speaker ||
    row?.name ||
    row?.row_index ||
    row?.source_item_id ||
    "(名称なし)"
  );
}

// ★ opendataと同じ
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

// ★ opendataと同じ
function formatChildContent(row) {
  const parsed = parseRowContent(row);

  if (parsed && typeof parsed === "object") {
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

// ★ opendata統一版
function renderDetailFromChild(row, parentRow) {
  const parsed = parseRowContent(row);

  const lines = [
    `院: ${parentRow?.name_of_house ?? ""}`,
    `会議名: ${parentRow?.name_of_meeting ?? ""}`,
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
    lines.push(formatChildContent(row));
  }

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

function bindParentCheckboxEvents() {
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
    const preview = content.replace(/\s+/g, " ").slice(0, 80);

    return `
      <tr class="clickable-row child-row" data-index="${index}">
        <td>${ctx.escapeHtml(rowNo)}</td>
        <td>${ctx.escapeHtml(preview)}</td>
      </tr>
    `;
  }).join("");

  bindChildRowEvents();
}

async function loadChildren(parentRow) {
  const data = await ctx.apiGet("/kokkai/rows", {
    name_of_house: parentRow.name_of_house,
    name_of_meeting: parentRow.name_of_meeting
  });

  return extractRowsFromResponse(data);
}

function bindParentRowEvents() {
  const rows = ctx.parentTableBody.querySelectorAll(".parent-row");

  rows.forEach((tr) => {
    tr.addEventListener("click", async (event) => {
      if (event.target.closest(".parent-check")) return;

      const index = Number(tr.dataset.index || "-1");
      const row = currentParentRows[index];
      if (!row) return;

      setSelectedParentRow(index);
      clearChildArea("子一覧を読み込み中...");

      try {
        const children = await loadChildren(row);
        renderChildTable(children, row);
      } catch (e) {
        clearChildArea(e.message);
      }
    });
  });
}

function renderParentTable(rows) {
  currentParentRows = Array.isArray(rows) ? rows : [];
  checkedParentIndexes = new Set();

  if (rows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    return;
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th></th>
      <th>院</th>
      <th>会議名</th>
      <th>件数</th>
    </tr>
  `;

  ctx.parentTableBody.innerHTML = rows.map((row, index) => `
    <tr class="clickable-row parent-row" data-index="${index}">
      <td><input type="checkbox" class="parent-check" data-index="${index}"></td>
      <td>${ctx.escapeHtml(row.name_of_house)}</td>
      <td>${ctx.escapeHtml(row.name_of_meeting)}</td>
      <td>${ctx.escapeHtml(row.row_count ?? "")}</td>
    </tr>
  `).join("");

  bindParentCheckboxEvents();
  bindParentRowEvents();
}

async function load(viewContext) {
  ctx = viewContext;

  try {
    ctx.renderParentPlaceholder("読み込み中...");
    const data = await ctx.apiGet("/kokkai/documents");
    renderParentTable(data.rows || []);
  } catch (e) {
    ctx.renderParentPlaceholder(e.message);
  }
}

function getCheckedRows() {
  return Array.from(checkedParentIndexes)
    .map(i => currentParentRows[i])
    .filter(Boolean);
}

function checkAll() {
  checkedParentIndexes = new Set(currentParentRows.map((_, i) => i));
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
