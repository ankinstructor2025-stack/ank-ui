document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("data-table-body");
  const sourceTypeSelect = document.getElementById("sourceTypeSelect");

  const items = [
    {
      row_index: 1,
      source_type: "api_kokkai",
      content: "これはサンプルのデータです。国会議事録やFAQ、説明文などがここに入ります。",
      created_at: "2026-03-06 10:00:00"
    },
    {
      row_index: 2,
      source_type: "url_caa",
      content: "消費者庁FAQのようなデータであれば、質問と回答がまとまったテキストとして入る想定です。",
      created_at: "2026-03-06 10:05:00"
    },
    {
      row_index: 3,
      source_type: "url_egov",
      content: "通常の説明ページであれば、制度説明や手順説明の本文が入ります。",
      created_at: "2026-03-06 10:10:00"
    }
  ];

  let currentItems = [...items];

  await loadSourceTypes();
  renderTable(currentItems);

  sourceTypeSelect.addEventListener("change", () => {
    const selected = sourceTypeSelect.value;

    if (!selected) {
      currentItems = [...items];
    } else {
      currentItems = items.filter(row => row.source_type === selected);
    }

    renderTable(currentItems);
  });

  async function loadSourceTypes() {
    try {
      const SOURCE_MASTER_URL = "https://storage.googleapis.com/ank-bucket/template/source_master.json";
      const res = await fetch(SOURCE_MASTER_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const sourceList = await res.json();

      sourceTypeSelect.innerHTML = [
        `<option value="">すべて</option>`,
        ...sourceList.map(src =>
          `<option value="${escapeHtml(src.key)}">${escapeHtml(src.label)}</option>`
        )
      ].join("");
    } catch (e) {
      console.error(e);
      sourceTypeSelect.innerHTML = `<option value="">データ種別読込失敗</option>`;
    }
  }

  function renderTable(rows) {
    if (!rows || rows.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3">データがありません</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td class="content-cell">${escapeHtml(row.content || "")}</td>
        <td>${escapeHtml(row.created_at || "")}</td>
      </tr>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
});
