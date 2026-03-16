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

async function apiPostJson(path, body) {
  if (!ctx || !ctx.apiBase) {
    throw new Error("apiBase が取得できません。");
  }

  const requestUrl = path.startsWith("/")
    ? `${ctx.apiBase}${path}`
    : `${ctx.apiBase}/${path}`;

  const headers = {
    "Content-Type": "application/json"
  };

  if (ctx.idToken) {
    headers.Authorization = `Bearer ${ctx.idToken}`;
  }

  const res = await fetch(requestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let message = `APIエラー (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) {
        message = err.detail;
      }
    } catch (_) {}
    throw new Error(message);
  }

  return await res.json();
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

function renderPromptPreviews(previews) {
  if (!ctx.detailPre) return;

  if (!Array.isArray(previews) || previews.length === 0) {
    ctx.detailPre.textContent = "生成プロンプトがありません。";
    return;
  }

  const blocks = previews.map((item, index) => {
    const label = item?.parent_label || item?.parent_source_id || `item ${index + 1}`;
    const promptText = item?.prompt_text || "";

    return [
      `--- prompt ${index + 1} ---`,
      `対象: ${label}`,
      `job_item_id: ${item?.job_item_id || ""}`,
      "",
      promptText
    ].join("\n");
  });

  ctx.detailPre.textContent = blocks.join("\n\n========================================\n\n");
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

async function loadChildren(parentRow) {
  if (!parentRow?.name_of_house || !parentRow?.name_of_meeting) {
    throw new Error("親データに院名または会議名がありません。");
  }

  const data = await ctx.apiGet("/kokkai/rows", {
    name_of_house: parentRow.name_of_house,
    name_of_meeting: parentRow.name_of_meeting
  });

  const rows = extractRowsFromResponse(data);

  if (!Array.isArray(rows)) {
    throw new Error("子一覧データの形式が不正です。");
  }

  return rows;
}

async function previewKnowledge() {
  const checkedRows = getCheckedRows();

  if (!checkedRows.length) {
    if (ctx.detailPre) {
      ctx.detailPre.textContent = "親一覧で対象をチェックしてください。";
    }
    return;
  }

  if (ctx.btnKnowledge) {
    ctx.btnKnowledge.disabled = true;
  }

  if (ctx.contextSummary) {
    ctx.contextSummary.textContent = `ナレッジ化: ${checkedRows.length} 件`;
  }

  if (ctx.detailPre) {
    ctx.detailPre.textContent = "生成プロンプトを作成中です...";
  }

  try {
    const body = {
      source_type: "kokkai",
      source_name: "国会議事録",
      request_type: "extract_knowledge",
      preview_only: true,
      items: checkedRows.map((row) => ({
        source_type: "kokkai",
        parent_source_id: row.source_id,
        parent_key1: row.name_of_house || "",
        parent_key2: row.name_of_meeting || "",
        parent_label: formatParentLabel(row),
        row_count: Number(row.row_count || 0)
      }))
    };

    const data = await apiPostJson("/knowledge/kokkai/jobs", body);
    const previews = Array.isArray(data?.prompt_previews) ? data.prompt_previews : [];

    renderPromptPreviews(previews);

    if (ctx.selectionSummary) {
      ctx.selectionSummary.textContent = `選択 ${checkedRows.length} 件 / preview ${previews.length} 件`;
    }

    if (ctx.contextSummary) {
      ctx.contextSummary.textContent = `ナレッジ化 preview: ${previews.length} 件`;
    }
  } catch (e) {
    console.error(e);
    if (ctx.detailPre) {
      ctx.detailPre.textContent = e.message || "生成プロンプト作成でエラーが発生しました。";
    }
  } finally {
    updateCheckedSummary();
  }
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
  checkedParentIndexes = new Set();

  if (!Array.isArray(rows) || rows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    clearChildArea("親一覧から1件選択してください。");

    if (ctx.summaryText) ctx.summaryText.textContent = "0 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: 国会議事録";
    if (ctx.detailPre) ctx.detailPre.textContent = "データがありません。";

    updateCheckedSummary();
    return;
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th class="checkbox-cell"></th>
      <th class="medium-cell">院</th>
      <th>会議名</th>
      <th class="narrow-cell">件数</th>
    </tr>
  `;

  ctx.parentTableBody.innerHTML = rows.map((row, index) => {
    return `
      <tr class="clickable-row parent-row" data-index="${index}">
        <td class="checkbox-cell">
          <input
            type="checkbox"
            class="parent-check"
            data-index="${index}"
          >
        </td>
        <td>${ctx.escapeHtml(row.name_of_house ?? "")}</td>
        <td>${ctx.escapeHtml(row.name_of_meeting ?? "")}</td>
        <td>${ctx.escapeHtml(row.row_count ?? "")}</td>
      </tr>
    `;
  }).join("");

  bindParentCheckboxEvents();
  bindParentRowEvents();

  clearChildArea("親一覧から1件選択してください。");

  if (ctx.summaryText) ctx.summaryText.textContent = `${rows.length} 件`;
  if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: 国会議事録";
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
