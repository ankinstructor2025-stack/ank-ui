document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("data-table-body");

  const items = [
    {
      row_index: 1,
      content: "これはサンプルのデータです。国会議事録やFAQ、説明文などがここに入ります。",
      created_at: "2026-03-06 10:00:00"
    },
    {
      row_index: 2,
      content: "消費者庁FAQのようなデータであれば、質問と回答がまとまったテキストとして入る想定です。",
      created_at: "2026-03-06 10:05:00"
    },
    {
      row_index: 3,
      content: "通常の説明ページであれば、制度説明や手順説明の本文が入ります。",
      created_at: "2026-03-06 10:10:00"
    }
  ];

  renderTable(items);

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
