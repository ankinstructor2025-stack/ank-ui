document.addEventListener("DOMContentLoaded", async () => {
  const tableHead = document.getElementById("data-table-head");
  const tableBody = document.getElementById("data-table-body");
  const sourceTypeSelect = document.getElementById("sourceTypeSelect");

  const btnMenu = document.getElementById("btnMenu");
  const btnLogout = document.getElementById("btnLogout");

  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageInfo = document.getElementById("pageInfo");
  const resultInfo = document.getElementById("resultInfo");

  const detailCard = document.getElementById("detailCard");
  const detailMeta = document.getElementById("detailMeta");
  const detailSpeech = document.getElementById("detailSpeech");

  let sourceList = [];
  let sourceMap = {};

  let currentSourceType = "";
  let currentRows = [];
  let currentPage = 1;
  let totalCount = 0;
  const pageSize = 10;

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
    prevPageBtn.addEventListener("click", async () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      await reloadCurrentPage();
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", async () => {
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      if (currentPage >= totalPages) return;
      currentPage += 1;
      await reloadCurrentPage();
    });
  }

  tableBody.addEventListener("click", (event) => {
    const rowEl = event.target.closest(".kokkai-row");
    if (!rowEl) return;

    const index = Number(rowEl.dataset.index);
    const row = currentRows[index];
    if (!row) return;

    tableBody.querySelectorAll(".kokkai-row").forEach(el => {
      el.classList.remove("selected");
    });

    rowEl.classList.add("selected");
    showDetail(row);
  });

  sourceTypeSelect.addEventListener("change", async () => {
    const selected = sourceTypeSelect.value;
    currentSourceType = selected;
    currentPage = 1;
    totalCount = 0;
    currentRows = [];

    hideDetail();

    if (!selected) {
      renderKokkaiHeader();
      renderMessageRow("データ種別を選択してください", 5);
      updatePager();
      return;
    }

    const p = sourceMap[selected];
    if (!p) {
      renderKokkaiHeader();
      renderMessageRow("データ種別が不正です", 5);
      updatePager();
      return;
    }

    if (selected !== "api_kokkai") {
      renderKokkaiHeader();
      renderMessageRow("国会議事録を選択してください", 5);
      updatePager();
      return;
    }

    await reloadCurrentPage();
  });

  async function reloadCurrentPage() {
    try {
      const offset = (currentPage - 1) * pageSize;
      const data = await fetchRowsBySourceType(currentSourceType, pageSize, offset);

      totalCount = Number(data.total_count || 0);
      currentRows = (data.rows || [])
        .map(row => parseKokkaiRow(row))
        .filter(row => row !== null);

      renderCurrentPage();
    } catch (e) {
      console.error(e);
      currentRows = [];
      totalCount = 0;
      renderKokkaiHeader();
      renderMessageRow(`読込失敗: ${e.message}`, 5);
      hideDetail();
      updatePager();
    }
  }

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

  async function fetchRowsBySourceType(sourceType, limit, offset) {
    const idToken = sessionStorage.getItem("idToken");
    if (!idToken) {
      throw new Error("idToken がありません");
    }

    const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";
    const url =
      `${API_BASE}/row_data` +
      `?source_type=${encodeURIComponent(sourceType)}` +
      `&limit=${encodeURIComponent(limit)}` +
      `&offset=${encodeURIComponent(offset)}`;

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

    return await res.json();
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
        speech: shortenText(normalizeText(obj.speech), 160),
        speech_full: normalizeText(obj.speech),
      };
    } catch (e) {
      return null;
    }
  }

  function renderCurrentPage() {
    renderKokkaiHeader();

    if (!currentRows || currentRows.length === 0) {
      renderMessageRow("データがありません", 5);
      hideDetail();
      updatePager();
      return;
    }

    tableBody.innerHTML = currentRows.map((row, index) => `
      <tr class="kokkai-row" data-index="${index}">
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.house)}</td>
        <td>${escapeHtml(row.meeting)}</td>
        <td>${escapeHtml(row.speaker)}</td>
        <td class="content-cell">${escapeHtml(row.speech)}</td>
      </tr>
    `).join("");

    hideDetail();
    updatePager();
  }

  function showDetail(row) {
    if (!detailCard || !detailMeta || !detailSpeech) {
      console.error("detailCard / detailMeta / detailSpeech が見つかりません");
      return;
    }

    detailCard.style.display = "block";
    detailMeta.textContent =
      `${row.date} / ${row.house} / ${row.meeting} / ${row.speaker}`;
    detailSpeech.textContent = row.speech_full || "";
  }

  function hideDetail() {
    if (!detailCard || !detailMeta || !detailSpeech) return;

    detailCard.style.display = "none";
    detailMeta.textContent = "行を選択してください";
    detailSpeech.textContent = "";
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
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    pageInfo.textContent = `${currentPage} / ${totalPages}`;
    resultInfo.textContent = `${totalCount} 件`;

    if (prevPageBtn) {
      prevPageBtn.disabled = currentPage <= 1;
    }

    if (nextPageBtn) {
      nextPageBtn.disabled = totalCount === 0 || currentPage >= totalPages;
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
