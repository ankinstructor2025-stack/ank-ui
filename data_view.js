document.addEventListener("DOMContentLoaded", async () => {
  const tableHead = document.getElementById("data-table-head");
  const tableBody = document.getElementById("data-table-body");
  const sourceTypeSelect = document.getElementById("sourceTypeSelect");

  const btnMenu = document.getElementById("btnMenu");
  const btnLogout = document.getElementById("btnLogout");

  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");

  let sourceList = [];
  let sourceMap = {};

  let currentRows = [];
  let currentPage = 1;
  const pageSize = 100;

  await loadSourceMaster();

  renderKokkaiHeader();
  renderMessageRow("データ種別を選択してください", 5);
  updatePager();

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

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      renderCurrentPage();
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize));
      if (currentPage >= totalPages) return;
      currentPage += 1;
      renderCurrentPage();
    });
  }

  sourceTypeSelect.addEventListener("change", async () => {
    const selected = sourceTypeSelect.value;

    if (!selected) {
      currentRows = [];
      currentPage = 1;
      renderKokkaiHeader();
      renderMessageRow("データ種別を選択してください", 5);
      updatePager();
      return;
    }

    const p = sourceMap[selected];
    if (!p) {
      currentRows = [];
      currentPage = 1;
      renderKokkaiHeader();
      renderMessageRow("データ種別が不正です", 5);
      updatePager();
      return;
    }

    if (selected !== "api_kokkai") {
      currentRows = [];
      currentPage = 1;
      renderKokkaiHeader();
      renderMessageRow("国会議事録を選択してください", 5);
      updatePager();
      return;
    }

    try {
      const rows = await fetchRowsBySourceType(selected);

      currentRows = rows
        .map(row => parseKokkaiRow(row))
        .filter(row => row !== null);

      currentPage = 1;
      renderCurrentPage();
    } catch (e) {
      console.error(e);
      currentRows = [];
      currentPage = 1;
      renderKokkaiHeader();
      renderMessageRow(`読込失敗: ${e.message}`, 5);
      updatePager();
    }
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

  async function fetchRowsBySourceType(sourceType) {
    const idToken = sessionStorage.getItem("idToken");
    if (!idToken) {
      throw new Error("idToken がありません");
    }

    const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";
    const url = `${API_BASE}/row_data?source_type=${encodeURIComponent(sourceType)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.rows)) {
      return data.rows;
    }

    return [];
  }

  function parseKokkaiRow(row) {
    try {
      const obj = typeof row.content === "string"
        ? JSON.parse(row.content)
        : row.content;

      return {
        date: normalizeText(obj.date),
        house: normalizeText(obj.nameOfHouse),
        meeting: normalizeText(obj.nameOfMeeting),
        speaker: normalizeText(obj.speaker),
        speech: shortenText(normalizeText(obj.speech), 200)
      };
    } catch (e) {
      return null;
    }
  }

  function renderCurrentPage() {
    renderKokkaiHeader();

    if (!currentRows || currentRows.length === 0) {
      renderMessageRow("データがありません", 5);
      updatePager();
      return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageRows = currentRows.slice(start, end);

    tableBody.innerHTML = pageRows.map(row => `
      <tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.house)}</td>
        <td>${escapeHtml(row.meeting)}</td>
        <td>${escapeHtml(row.speaker)}</td>
        <td class="content-cell">${escapeHtml(row.speech)}</td>
      </tr>
    `).join("");

    updatePager();
  }

  function renderKokkaiHeader() {
    tableHead.innerHTML = `
      <tr>
        <th style="width: 120px;">日付</th>
        <th style="width: 90px;">院</th>
        <th style="width: 180px;">会議名</th>
        <th style="width: 140px;">発言者</th>
        <th>発言内容</th>
      </tr>
    `;
  }

  function renderMessageRow(message, colspan) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${colspan}">${escapeHtml(message)}</td>
      </tr>
    `;
  }

  function updatePager() {
    const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize));
    pageInfo.textContent = `${currentPage} / ${totalPages}`;

    if (prevPageBtn) {
      prevPageBtn.disabled = currentPage <= 1;
    }

    if (nextPageBtn) {
      nextPageBtn.disabled = currentRows.length === 0 || currentPage >= totalPages;
    }
  }

  function shortenText(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + " ...";
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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
