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

function extractRowsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.children)) return data.children;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function toPreviewText(value, maxLength = 50) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

function toSpeakerText(value, maxLength = 15) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
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

  if (typeof ctx.refreshChildPager === "function") {
    ctx.refreshChildPager();
  }
}

function renderDetailFromChild(row, parentRow) {
  const lines = [
    `issue_id: ${parentRow?.issue_id ?? row?.issue_id ?? ""}`,
    `院: ${parentRow?.name_of_house ?? ""}`,
    `会議名: ${parentRow?.name_of_meeting ?? ""}`,
    `speech_id: ${row?.speech_id ?? ""}`,
    `status: ${row?.status ?? ""}`,
    `speaker: ${row?.speaker ?? ""}`,
    "",
    row?.speech ?? ""
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

function bindChildRowEvents(parentRow) {
  const rows = ctx.childTableBody.querySelectorAll(".child-row");

  rows.forEach((tr) => {
    tr.addEventListener("click", () => {
      const index = Number(tr.dataset.index || "-1");
      const row = currentChildRows[index];

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

  if (ctx.contextSummary) {
    ctx.contextSummary.textContent = `子一覧: ${formatParentLabel(parentRow)} / ${rows.length} 件`;
  }

  ctx.childTableHead.innerHTML = `
    <tr>
      <th style="width:160px;">発言者</th>
      <th>内容</th>
    </tr>
  `;

  ctx.childTableBody.innerHTML = rows.map((row, index) => {
    const speaker = toSpeakerText(row?.speaker || "", 15);
    const preview = toPreviewText(row?.speech || "", 50);

    return `
      <tr class="clickable-row child-row" data-index="${index}">
        <td
          title="${ctx.escapeHtml(row?.speaker ?? "")}"
          style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
        >
          ${ctx.escapeHtml(speaker)}
        </td>
        <td
          title="${ctx.escapeHtml(row?.speech ?? "")}"
          style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
        >
          ${ctx.escapeHtml(preview)}
        </td>
      </tr>
    `;
  }).join("");

  bindChildRowEvents(parentRow);

  if (typeof ctx.refreshChildPager === "function") {
    ctx.refreshChildPager();
  }

  if (rows.length > 0) {
    setSelectedChildRow(0);
    renderDetailFromChild(rows[0], parentRow);
  }
}

async function loadChildren(parentRow) {
  const data = await ctx.apiGet("/kokkai/rows", {
    issue_id: parentRow.issue_id
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
        clearChildArea(e.message || "子一覧の取得に失敗しました");
      }
    });
  });
}

function renderParentTable(rows) {
  currentParentRows = Array.isArray(rows) ? rows : [];
  checkedParentIndexes = new Set();
  selectedParentIndex = -1;

  if (rows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    updateCheckedSummary();
    if (typeof ctx.refreshParentPager === "function") {
      ctx.refreshParentPager();
    }
    return;
  }

  if (ctx.contextSummary) {
    ctx.contextSummary.textContent = "親一覧";
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th style="width:44px;"></th>
      <th style="width:110px;">院</th>
      <th>会議名</th>
      <th style="width:80px;">件数</th>
    </tr>
  `;

  ctx.parentTableBody.innerHTML = rows.map((row, index) => `
    <tr class="clickable-row parent-row" data-index="${index}">
      <td>
        <input type="checkbox" class="parent-check" data-index="${index}">
      </td>
      <td
        title="${ctx.escapeHtml(row.name_of_house ?? "")}"
        style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
      >
        ${ctx.escapeHtml(row.name_of_house ?? "")}
      </td>
      <td
        title="${ctx.escapeHtml(row.name_of_meeting ?? "")}"
        style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
      >
        ${ctx.escapeHtml(row.name_of_meeting ?? "")}
      </td>
      <td
        style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
      >
        ${ctx.escapeHtml(row.row_count ?? "")}
      </td>
    </tr>
  `).join("");

  bindParentCheckboxEvents();
  bindParentRowEvents();
  updateCheckedSummary();
  clearChildArea("親一覧から1件選択してください。");

  if (typeof ctx.refreshParentPager === "function") {
    ctx.refreshParentPager();
  }
}

async function load(viewContext) {
  ctx = viewContext;

  try {
    ctx.renderParentPlaceholder("読み込み中...");
    const data = await ctx.apiGet("/kokkai/documents");
    renderParentTable(data.rows || []);
  } catch (e) {
    ctx.renderParentPlaceholder(e.message || "親一覧の取得に失敗しました");
    if (typeof ctx.refreshParentPager === "function") {
      ctx.refreshParentPager();
    }
  }
}

function getCheckedRows() {
  return Array.from(checkedParentIndexes)
    .sort((a, b) => a - b)
    .map((i) => currentParentRows[i])
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
