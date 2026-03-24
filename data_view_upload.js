console.log("data_view_upload.js loaded");

window.DataViewUpload = (() => {

let currentParentRows = [];
let selectedParentIndex = -1;
let checkedParentIndexes = new Set();
let ctx = null;

function formatParentLabel(row) {
  return (
    row?.title ||
    row?.file_name ||
    row?.file_id ||
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

function clearChildArea(message = "子データはありません。") {
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

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function renderDetailFromParent(row) {
  const lines = [
    `file_id: ${row?.file_id ?? ""}`,
    `file_name: ${row?.file_name ?? ""}`,
    `ext: ${row?.ext ?? ""}`,
    `created_at: ${row?.created_at ?? ""}`,
    `gcs_path: ${row?.gcs_path ?? ""}`,
    `file_size: ${formatFileSize(row?.file_size)}`
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

async function downloadFile(row) {
  const fileId = row?.file_id;
  if (!fileId) {
    throw new Error("file_id がありません。");
  }

  const url = `${ctx.apiBase}/upload/download?file_id=${encodeURIComponent(fileId)}`;

  const idToken = sessionStorage.getItem("idToken");
  if (!idToken) {
    throw new Error("ログイン情報が見つかりません。");
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    let detail = `ダウンロード失敗 (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch (_) {
      try {
        const text = await res.text();
        if (text) detail = text;
      } catch (_) {}
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  const downloadName = row.file_name || `${fileId}`;

  const objectUrl = window.URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
}

function bindDownloadEvents() {
  if (!ctx?.parentTableBody) return;

  const buttons = ctx.parentTableBody.querySelectorAll(".btn-download");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const index = Number(btn.dataset.index || "-1");
      const row = currentParentRows[index];
      if (!row) return;

      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "取得中";

      try {
        await downloadFile(row);
      } catch (e) {
        console.error(e);
        alert(e.message || "ダウンロードに失敗しました");
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });
}

function bindParentRowEvents() {
  const rows = ctx.parentTableBody.querySelectorAll(".parent-row");

  rows.forEach((tr) => {
    tr.addEventListener("click", (event) => {
      if (event.target.closest(".parent-check")) {
        return;
      }

      if (event.target.closest(".btn-download")) {
        return;
      }

      const index = Number(tr.dataset.index || "-1");
      const row = currentParentRows[index];

      if (!row) return;

      setSelectedParentRow(index);
      clearChildArea("子データはありません。");

      if (ctx.contextSummary) {
        ctx.contextSummary.textContent = `ファイル: ${formatParentLabel(row)}`;
      }

      renderDetailFromParent(row);
    });
  });
}

function renderParentTable(rows) {
  const filteredRows = Array.isArray(rows) ? rows : [];

  currentParentRows = filteredRows;
  selectedParentIndex = -1;
  checkedParentIndexes = new Set();

  if (filteredRows.length === 0) {
    ctx.renderParentPlaceholder("データがありません。");
    clearChildArea("子データはありません。");

    if (ctx.summaryText) ctx.summaryText.textContent = `${filteredRows.length} 件`;
    if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: アップロード";
    if (ctx.detailPre) ctx.detailPre.textContent = "データがありません。";

    updateCheckedSummary();
    return;
  }

  ctx.parentTableHead.innerHTML = `
    <tr>
      <th class="checkbox-cell"></th>
      <th>ファイル名</th>
      <th class="narrow-cell">ext</th>
      <th class="medium-cell">作成日</th>
      <th class="narrow-cell">DL</th>
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
        <td title="${ctx.escapeHtml(formatParentLabel(row))}">
          ${ctx.escapeHtml(formatParentLabel(row))}
        </td>
        <td>${ctx.escapeHtml(row.ext ?? "")}</td>
        <td>${ctx.escapeHtml(formatDateTime(row.created_at))}</td>
        <td>
          <button
            type="button"
            class="btn btn-primary btn-download"
            data-index="${index}"
          >
            DL
          </button>
        </td>
      </tr>
    `;
  }).join("");

  bindParentCheckboxEvents();
  bindParentRowEvents();
  bindDownloadEvents();
  syncParentCheckboxUi();

  clearChildArea("子データはありません。");

  if (ctx.summaryText) ctx.summaryText.textContent = `${filteredRows.length} 件`;
  if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: アップロード";
  if (ctx.detailPre) ctx.detailPre.textContent = "親一覧を表示しました。";

  updateCheckedSummary();
}

async function load(viewContext) {
  ctx = viewContext;

  currentParentRows = [];
  selectedParentIndex = -1;
  checkedParentIndexes = new Set();

  clearChildArea("子データはありません。");

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
    clearChildArea("子データはありません。");

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
