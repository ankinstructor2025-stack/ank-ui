document.addEventListener("DOMContentLoaded", async () => {

  const tableBody = document.getElementById("data-table-body");
  const sourceTypeSelect = document.getElementById("sourceTypeSelect");

  const SOURCE_MASTER_URL =
    "https://storage.googleapis.com/ank-bucket/template/source_master.json";

  const items = [
    {
      row_index: 1,
      source_type: "api_kokkai",
      content: "これはサンプルのデータです。国会議事録やFAQ、説明文などがここに入ります。",
      created_at: "2026-03-06 10:00:00"
    }
  ];

  await loadSourceTypes();

  sourceTypeSelect.addEventListener("change", () => {

    const selected = sourceTypeSelect.value;

    if (!selected) {
      tableBody.innerHTML =
        `<tr><td colspan="3">データ種別を選択してください</td></tr>`;
      return;
    }

    const rows = items.filter(row => row.source_type === selected);

    renderTable(rows);

  });

  async function loadSourceTypes() {

    try {

      const res = await fetch(SOURCE_MASTER_URL);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const sourceList = await res.json();

      renderSourceOptions(sourceList);

    } catch (e) {

      console.error(e);

      sourceTypeSelect.innerHTML =
        `<option value="">データ種別読込失敗</option>`;

    }
  }

  function renderSourceOptions(sourceList) {

    const groups = {};

    sourceList.forEach(item => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    });

    const html = [
      `<option value="">選択してください</option>`
    ];

    Object.keys(groups).forEach(groupName => {

      html.push(`<optgroup label="${escapeHtml(groupName)}">`);

      groups[groupName].forEach(item => {

        html.push(
          `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
        );

      });

      html.push(`</optgroup>`);

    });

    sourceTypeSelect.innerHTML = html.join("");

  }

  function renderTable(rows) {

    if (!rows || rows.length === 0) {

      tableBody.innerHTML =
        `<tr><td colspan="3">データがありません</td></tr>`;

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
