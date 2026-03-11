console.log("data_view.js loaded");

const sourceSelect = document.getElementById("sourceSelect");
const sourceName = document.getElementById("sourceName");

const btnReload = document.getElementById("btnReload");
const btnKnowledge = document.getElementById("btnKnowledge");
const btnMenu = document.getElementById("btnMenu");
const btnBack = document.getElementById("btnBack");
const btnLogout = document.getElementById("btnLogout");

const summaryText = document.getElementById("summaryText");
const selectionSummary = document.getElementById("selectionSummary");
const contextSummary = document.getElementById("contextSummary");

const parentTableHead = document.getElementById("parentTableHead");
const parentTableBody = document.getElementById("parentTableBody");
const childTableHead = document.getElementById("childTableHead");
const childTableBody = document.getElementById("childTableBody");

const detailPre = document.getElementById("detailPre");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let sourceList = [];
let sourceMap = {};
let currentSourceKey = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getIdToken() {
  return sessionStorage.getItem("idToken");
}

function requireIdToken() {
  const idToken = getIdToken();
  if (!idToken) {
    throw new Error("ログイン情報が見つかりません");
  }
  return idToken;
}

function buildApiUrl(path, query = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE}${normalizedPath}`);

  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  return url.toString();
}

async function apiGet(path, query = {}) {
  const idToken = requireIdToken();
  const url = buildApiUrl(path, query);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    let detail = `APIエラー (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data && data.detail) detail = data.detail;
    } catch (_) {}
    throw new Error(detail);
  }

  return await res.json();
}

function renderInitialScreen() {
  if (parentTableHead) parentTableHead.innerHTML = "";
  if (parentTableBody) {
    parentTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>データ種別を選択してください。</td>
      </tr>
    `;
  }

  if (childTableHead) childTableHead.innerHTML = "";
  if (childTableBody) {
    childTableBody.innerHTML = `
      <tr class="placeholder-row">
        <td>親一覧から1件選択してください。</td>
      </tr>
    `;
  }

  if (detailPre) {
    detailPre.textContent = "データ種別を選択してください。";
  }

  if (summaryText) summaryText.textContent = "0 件";
  if (selectionSummary) selectionSummary.textContent = "選択 0 件";
  if (contextSummary) contextSummary.textContent = "親一覧";
  if (btnKnowledge) btnKnowledge.disabled = true;
}

function renderSourceOptions(list) {
  const groups = {};

  list.forEach((item) => {
    const groupName = item.group || "その他";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
  });

  const html = [
    `<option value="" selected disabled>選択してください</option>`
  ];

  Object.keys(groups).forEach((groupName) => {
    html.push(`<optgroup label="${escapeHtml(groupName)}">`);

    groups[groupName].forEach((item) => {
      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label || item.key)}</option>`
      );
    });

    html.push(`</optgroup>`);
  });

  if (sourceSelect) {
    sourceSelect.innerHTML = html.join("");
  }
}

function mapKeyToSourceType(key, type) {
  if (key === "api_kokkai") return "kokkai";
  if (key === "api_datago") return "opendata";
  if (type === "public_url" || String(key || "").startsWith("url_")) return "public_url";
  if (key === "file_upload") return "upload";
  return "";
}

function normalizeSourceMaster(list) {
  if (!Array.isArray(list)) return [];

  return list.map((item) => ({
    key: item.key,
    label: item.label || item.name || item.key,
    group: item.group || "その他",
    type: item.type || "",
    sourceType: mapKeyToSourceType(item.key, item.type)
  }));
}

function updateSourceName() {
  const item = sourceMap[currentSourceKey];
  const text = item ? item.label : "";

  if (!sourceName) return;

  if ("value" in sourceName) {
    sourceName.value = text;
  } else {
    sourceName.textContent = text;
  }
}

async function loadSourceMaster() {
  try {
    const res = await fetch("./source_master.json", { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();

    sourceList = normalizeSourceMaster(json);
    sourceMap = {};

    sourceList.forEach((item) => {
      sourceMap[item.key] = item;
    });

    renderSourceOptions(sourceList);
    updateSourceName();

  } catch (e) {
    console.error(e);

    if (sourceSelect) {
      sourceSelect.innerHTML =
        `<option value="" selected disabled>データ種別読込失敗</option>`;
    }

    if (detailPre) {
      detailPre.textContent = `データ種別読込失敗: ${e.message}`;
    }
  }
}

function renderParentPlaceholder(message) {
  parentTableHead.innerHTML = "";
  parentTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderKokkaiParentTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    renderParentPlaceholder("データがありません。");
    if (summaryText) summaryText.textContent = "0 件";
    if (contextSummary) contextSummary.textContent = "親一覧: 国会議事録";
    return;
  }

  parentTableHead.innerHTML = `
    <tr>
      <th class="medium-cell">院</th>
      <th>会議名</th>
      <th class="narrow-cell">件数</th>
      <th class="narrow-cell">状態</th>
    </tr>
  `;

  parentTableBody.innerHTML = rows.map((row) => {
    return `
      <tr class="clickable-row">
        <td>${escapeHtml(row.name_of_house ?? "")}</td>
        <td>${escapeHtml(row.name_of_meeting ?? "")}</td>
        <td>${escapeHtml(row.row_count ?? "")}</td>
        <td>${escapeHtml(row.status ?? "")}</td>
      </tr>
    `;
  }).join("");

  if (summaryText) summaryText.textContent = `${rows.length} 件`;
  if (selectionSummary) selectionSummary.textContent = "選択 0 件";
  if (contextSummary) contextSummary.textContent = "親一覧: 国会議事録";
  if (detailPre) detailPre.textContent = "親一覧を表示しました。";
}

async function refreshParentList() {
  if (!currentSourceKey) {
    renderParentPlaceholder("データ種別を選択してください。");
    return;
  }

  const source = sourceMap[currentSourceKey];
  if (!source) {
    renderParentPlaceholder("データ種別を選択してください。");
    return;
  }

  childTableHead.innerHTML = "";
  childTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td>親一覧から1件選択してください。</td>
    </tr>
  `;

  if (source.key !== "api_kokkai") {
    renderParentPlaceholder("この簡易版は国会議事録の親一覧表示まで対応しています。");
    if (detailPre) {
      detailPre.textContent = `選択中: ${source.label}`;
    }
    if (contextSummary) {
      contextSummary.textContent = `親一覧: ${source.label}`;
    }
    return;
  }

  try {
    renderParentPlaceholder("親一覧を読み込み中です...");
    if (detailPre) {
      detailPre.textContent = "国会議事録の親一覧を読み込み中です...";
    }

    const data = await apiGet("/kokkai/documents");
    const rows = Array.isArray(data.rows) ? data.rows : [];

    renderKokkaiParentTable(rows);

  } catch (e) {
    console.error(e);
    renderParentPlaceholder(e.message);
    if (detailPre) {
      detailPre.textContent = e.message;
    }
  }
}

async function handleSourceChange() {
  currentSourceKey = sourceSelect ? sourceSelect.value : "";
  updateSourceName();
  await refreshParentList();
}

function bindEvents() {
  if (sourceSelect) {
    sourceSelect.addEventListener("change", handleSourceChange);
  }

  if (btnReload) {
    btnReload.addEventListener("click", async () => {
      await refreshParentList();
    });
  }

  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      window.location.href = "./menu.html";
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = "./menu.html";
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      sessionStorage.removeItem("idToken");
      window.location.href = "./index.html";
    });
  }

  if (btnKnowledge) {
    btnKnowledge.addEventListener("click", () => {
      alert("この版は国会議事録の親一覧表示までです。");
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderInitialScreen();
  bindEvents();
  await loadSourceMaster();
});
