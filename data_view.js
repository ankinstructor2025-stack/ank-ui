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

  renderDefaultHeader();
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
    const rowEl = event.target.closest(".data-row");
    if (!rowEl) return;

    const index = Number(rowEl.dataset.index);
    const row = currentRows[index];
    if (!row) return;

    tableBody.querySelectorAll(".data-row").forEach(el => {
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
      renderDefaultHeader();
      renderMessageRow("データ種別を選択してください", 5);
      updatePager();
      return;
    }

    const p = sourceMap[selected];
    if (!p) {
      renderDefaultHeader();
      renderMessageRow("データ種別が不正です", 5);
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
        .map(row => parseRowBySourceType(currentSourceType, row))
        .filter(row => row !== null);

      renderCurrentPage();
    } catch (e) {
      console.error(e);
      currentRows = [];
      totalCount = 0;
      renderHeaderBySourceType(currentSourceType);
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

  function parseRowBySourceType(sourceType, row) {
    if (sourceType === "api_kokkai") {
      return parseKokkaiRow(row);
    }

    if (sourceType === "api_datago") {
      return parseOpendataRow(row);
    }

    return parseGenericRow(row);
  }

  function parseKokkaiRow(row) {
    try {
      const obj = typeof row.content === "string"
        ? JSON.parse(row.content)
        : row.content;

      return {
        viewType: "kokkai",
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

  function parseOpendataRow(row) {
    try {
      const obj = typeof row.content === "string"
        ? JSON.parse(row.content)
        : row.content;

      const datasetId = normalizeText(obj.dataset_id);
      const title = normalizeText(obj.title);
      const sourcePath = normalizeText(obj.source_path);

      const data = obj.data || {};
      const organization = normalizeText(
        (data.organization && (data.organization.title || data.organization.name)) || ""
      );
      const notes = normalizeText(data.notes);
      const resources = Array.isArray(data.resources) ? data.resources : [];

      return {
        viewType: "opendata",
        dataset_id: datasetId,
        title: title,
        organization: organization,
        source_path: sourcePath,
        notes: shortenText(notes, 160),
        notes_full: notes,
        resource_count: resources.length,
        data_full: obj,
      };
    } catch (e) {
      return null;
    }
  }

  function parseGenericRow(row) {
    try {
      const obj = typeof row.content === "string"
        ? JSON.parse(row.content)
        : row.content;

      return {
        viewType: "generic",
        title: normalizeText(obj.title || row.source_item_id || ""),
        col2: normalizeText(obj.source_path || ""),
        col3: shortenText(normalizeText(JSON.stringify(obj)), 160),
        full: JSON.stringify(obj, null, 2),
      };
    } catch (e) {
      return {
        viewType: "generic",
        title: normalizeText(row.source_item_id || ""),
        col2: "",
        col3: shortenText(normalizeText(row.content || ""), 160),
        full: normalizeText(row.content || ""),
      };
    }
  }

  function renderCurrentPage() {
    renderHeaderBySourceType(currentSourceType);

    if (!currentRows || currentRows.length === 0) {
      renderMessageRow("データがありません", 5);
      hideDetail();
      updatePager();
      return;
    }

    if (currentSourceType === "api_kokkai") {
      renderKokkaiRows();
    } else if (currentSourceType === "api_datago") {
      renderOpendataRows();
    } else {
      renderGenericRows();
    }

    hideDetail();
    updatePager();
  }

  function renderKokkaiRows() {
    tableBody.innerHTML = currentRows.map((row, index) => `
      <tr class="data-row" data-index="${index}">
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.house)}</td>
        <td>${escapeHtml(row.meeting)}</td>
        <td>${escapeHtml(row.speaker)}</td>
        <td class="content-cell">${escapeHtml(row.speech)}</td>
      </tr>
    `).join("");
  }

  function renderOpendataRows() {
    tableBody.innerHTML = currentRows.map((row, index) => `
      <tr class="data-row" data-index="${index}">
        <td>${escapeHtml(row.dataset_id)}</td>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.organization)}</td>
        <td>${escapeHtml(String(row.resource_count))}</td>
        <td class="content-cell">${escapeHtml(row.notes)}</td>
      </tr>
    `).join("");
  }

  function renderGenericRows() {
    tableBody.innerHTML = currentRows.map((row, index) => `
      <tr class="data-row" data-index="${index}">
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.col2)}</td>
        <td colspan="3" class="content-cell">${escapeHtml(row.col3)}</td>
      </tr>
    `).join("");
  }

  function showDetail(row) {
    if (!detailCard || !detailMeta || !detailSpeech) {
      console.error("detailCard / detailMeta / detailSpeech が見つかりません");
      return;
    }

    detailCard.style.display = "block";

    if (row.viewType === "kokkai") {
      detailMeta.textContent =
        `${row.date} / ${row.house} / ${row.meeting} / ${row.speaker}`;
      detailSpeech.textContent = row.speech_full || "";
      return;
    }

    if (row.viewType === "opendata") {
      detailMeta.textContent =
        `${row.dataset_id} / ${row.title} / ${row.organization} / resource=${row.resource_count}`;

      const lines = [
        `source_path: ${row.source_path || ""}`,
        "",
        `notes:`,
        row.notes_full || "",
      ];

      detailSpeech.textContent = lines.join("\n");
      return;
    }

    detailMeta.textContent = row.title || "詳細";
    detailSpeech.textContent = row.full || "";
  }

  function hideDetail() {
    if (!detailCard || !detailMeta || !detailSpeech) return;

    detailCard.style.display = "none";
    detailMeta.textContent = "行を選択してください";
    detailSpeech.textContent = "";
  }

  function renderHeaderBySourceType(sourceType) {
    if (sourceType === "api_kokkai") {
      renderKokkaiHeader();
      return;
    }

    if (sourceType === "api_datago") {
      renderOpendataHeader();
      return;
    }

    renderDefaultHeader();
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

  function renderOpendataHeader() {
    tableHead.innerHTML = `
      <tr>
        <th style="width: 180px;">dataset_id</th>
        <th style="width: 280px;">タイトル</th>
        <th style="width: 180px;">組織</th>
        <th style="width: 100px;">資源数</th>
        <th>概要</th>
      </tr>
    `;
  }

  function renderDefaultHeader() {
    tableHead.innerHTML = `
      <tr>
        <th style="width: 220px;">項目1</th>
        <th style="width: 220px;">項目2</th>
        <th colspan="3">内容</th>
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
