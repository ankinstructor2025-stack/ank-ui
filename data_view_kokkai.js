console.log("data_view_kokkai.js loaded");

window.DataViewKokkai = (() => {

let currentParentRows = [];
let currentChildRows = [];
let selectedParentIndex = -1;
let selectedChildIndex = -1;
let ctx = null;

function formatParentLabel(row) {
  const house = row?.name_of_house || "";
  const meeting = row?.name_of_meeting || "";
  return [house, meeting].filter(Boolean).join(" / ");
}

function getParentIdentity(row) {
  return (
    row?.file_id ||
    row?.document_id ||
    row?.doc_id ||
    row?.source_id ||
    row?.parent_id ||
    row?.id ||
    ""
  );
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

function formatChildContent(row) {
  return (
    row?.content ||
    row?.answer ||
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
    `院: ${parentRow?.name_of_house ?? ""}`,
    `会議名: ${parentRow?.name_of_meeting ?? ""}`,
    `行番号: ${row?.row_index ?? ""}`,
    `source_item_id: ${row?.source_item_id ?? ""}`,
    "",
    formatChildContent(row) || formatChildTitle(row) || "詳細データがありません。"
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

      if (ctx.selectionSummary) {
        ctx.selectionSummary.textContent = "選択 1 件 / 子 1 件";
      }
    });
  });
}

function renderChildTable(rows, parentRow) {
  currentChildRows = Array.isArray(rows) ? rows : [];
  selectedChildIndex = -1;

  if (!Array.isArray(rows) || rows.length === 0) {
    clearChildArea("子データがありません。");

    if (ctx.selectionSummary) ctx.selectionSummary.textContent = "選択 1 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(parentRow)}`;
    if (ctx.btnKnowledge) ctx.btnKnowledge.disabled = false;

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

  if (ctx.selectionSummary) ctx.selectionSummary.textContent = "選択 1 件";
  if (ctx.contextSummary) ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(parentRow)}`;
  if (ctx.btnKnowledge) ctx.btnKnowledge.disabled = false;
}

async function loadChildren(parentRow) {
  const parentId = getParentIdentity(parentRow);

  if (!parentId) {
    throw new Error("親データに識別子がありません。");
  }

  const data = await ctx.apiGet(`/kokkai/documents/${encodeURIComponent(parentId)}/rows`);
  const rows = extractRowsFromResponse(data);

  if (!Array.isArray(rows)) {
    throw new Error("子一覧データの形式が不正です。");
  }

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

      clearChildArea("子一覧を読み込み中です...");

      if (ctx.selectionSummary) ctx.selectionSummary.textContent = "選択 1 件";
      if (ctx.btnKnowledge) ctx.btnKnowledge.disabled = true;

      ctx.detailPre.textContent =
        `選択中: ${formatParentLabel(row)}\n子一覧を読み込み中です...`;

      try {
        const children = await loadChildren(row);
        renderChildTable(children, row);

        ctx.detailPre.textContent =
          `選択中: ${formatParentLabel(row)}\n子一覧を表示しました。`;
      } catch (e) {
        console.error(e);
        clearChildArea(e.message);
        ctx.detailPre.textContent = e.message;
      }
    });
  });
}

function renderParentTable(rows) {
  currentParentRows = Array.isArray(rows) ? rows : [];
  currentChildRows = [];
  selectedParentIndex = -1;
  selectedChildIndex = -1;

  if (!Array.isArray(rows) || rows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    clearChildArea("親一覧から1件選択してください。");

    if (ctx.summaryText) ctx.summaryText.textContent = "0 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: 国会議事録";

    return;
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th class="medium-cell">院</th>
      <th>会議名</th>
      <th class="narrow-cell">件数</th>
      <th class="narrow-cell">状態</th>
    </tr>
  `;

  ctx.parentTableBody.innerHTML = rows.map((row, index) => {

    return `
      <tr class="clickable-row parent-row" data-index="${index}">
        <td>${ctx.escapeHtml(row.name_of_house ?? "")}</td>
        <td>${ctx.escapeHtml(row.name_of_meeting ?? "")}</td>
        <td>${ctx.escapeHtml(row.row_count ?? "")}</td>
        <td>
          <span class="${ctx.getStatusClass(row.status)}">
            ${ctx.escapeHtml(row.status ?? "")}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  bindParentRowEvents();

  clearChildArea("親一覧から1件選択してください。");

  if (ctx.summaryText) ctx.summaryText.textContent = `${rows.length} 件`;
  if (ctx.selectionSummary) ctx.selectionSummary.textContent = "選択 0 件";
  if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: 国会議事録";
  if (ctx.detailPre) ctx.detailPre.textContent = "親一覧を表示しました。";
  if (ctx.btnKnowledge) ctx.btnKnowledge.disabled = true;
}

async function load(viewContext) {

  ctx = viewContext;

  currentParentRows = [];
  currentChildRows = [];
  selectedParentIndex = -1;
  selectedChildIndex = -1;

  clearChildArea("親一覧から1件選択してください。");

  try {
    ctx.renderParentPlaceholder("親一覧を読み込み中です...");

    if (ctx.detailPre) {
      ctx.detailPre.textContent = "国会議事録の親一覧を読み込み中です...";
    }

    const data = await ctx.apiGet("/kokkai/documents");
    const rows = Array.isArray(data.rows) ? data.rows : [];

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

return {
  load
};
})();
