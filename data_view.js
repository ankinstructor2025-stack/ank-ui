document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("data-table-body");
  const sourceTypeSelect = document.getElementById("sourceTypeSelect");

  const btnMenu = document.getElementById("btnMenu");
  const btnLogout = document.getElementById("btnLogout");

  let sourceList = [];
  let sourceMap = {};

  await loadSourceMaster();

  tableBody.innerHTML = `
    <tr>
      <td colspan="3">データ種別を選択してください</td>
    </tr>
  `;

  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      window.location.href = "menu.html";
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      sessionStorage.removeItem("idToken");
      window.location.href = "index.html";
    });
  }

  sourceTypeSelect.addEventListener("change", () => {
    const selected = sourceTypeSelect.value;

    if (!selected) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3">データ種別を選択してください</td>
        </tr>
      `;
      return;
    }

    const p = sourceMap[selected];
    if (!p) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3">データ種別が不正です</td>
        </tr>
      `;
      return;
    }

    renderTable([]);
  });

  async function loadSourceMaster() {
    try {
      const res = await fetch("./source_master.json");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      sourceList = await res.json();
      sourceMap = Object.fromEntries(sourceList.map(item => [item.key, item]));

      renderSourceOptions(sourceList);
    } catch (e) {
      console.error(e);
      sourceTypeSelect.innerHTML = `<option value="">データ種別読込失敗</option>`;
    }
  }

  function renderSourceOptions(list) {
    const groups = {};

    list.forEach(item => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    });

    const html = [`<option value="">選択してください</option>`];

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
