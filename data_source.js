console.log("data_source.js loaded");

const sourceSelect = document.getElementById("sourceSelect");
const sourceName = document.getElementById("sourceName");

const panelEmpty = document.getElementById("panelEmpty");
const panelKokkai = document.getElementById("panelKokkai");
const panelUpload = document.getElementById("panelUpload");
const panelOpenData = document.getElementById("panelOpenData");
const panelUrl = document.getElementById("panelUrl");
const panelApi = document.getElementById("panelApi");

const logBox = document.getElementById("logBox");
const logText = document.getElementById("logText");

const btnLogout = document.getElementById("btnLogout");
const btnMenu = document.getElementById("btnMenu");
const btnClearLog = document.getElementById("btnClearLog");

const btnKokkaiRegister = document.getElementById("btnKokkaiRegister");
const btnUploadRegister = document.getElementById("btnUploadRegister");

const btnFetchDatasets = document.getElementById("btnFetchDatasets");
const btnFetchResources = document.getElementById("btnFetchResources");
const btnRegisterResource = document.getElementById("btnRegisterResource");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let sourceList = [];
let sourceMap = {};

function hideAllPanels() {
  if (panelEmpty) panelEmpty.classList.add("hidden");
  if (panelKokkai) panelKokkai.classList.add("hidden");
  if (panelUpload) panelUpload.classList.add("hidden");
  if (panelOpenData) panelOpenData.classList.add("hidden");
  if (panelUrl) panelUrl.classList.add("hidden");
  if (panelApi) panelApi.classList.add("hidden");
}

function showPanelByKey(key) {
  hideAllPanels();

  const p = sourceMap[key];
  if (!p) {
    if (panelEmpty) panelEmpty.classList.remove("hidden");
    return;
  }

  if (key === "api_kokkai") {
    if (panelKokkai) panelKokkai.classList.remove("hidden");
    return;
  }

  if (key === "file_upload") {
    if (panelUpload) panelUpload.classList.remove("hidden");
    return;
  }

  if (key === "api_datago") {
    if (panelOpenData) panelOpenData.classList.remove("hidden");
    return;
  }

  if (p.type === "public_url") {
    if (panelUrl) panelUrl.classList.remove("hidden");
    return;
  }

  if (p.type === "public_api") {
    if (panelApi) panelApi.classList.remove("hidden");
    return;
  }

  if (panelEmpty) panelEmpty.classList.remove("hidden");
}

function clearLog() {
  if (logText) logText.textContent = "";
  if (logBox) logBox.classList.add("hidden");
}

function writeLog(msg) {
  if (!logBox || !logText) return;
  logBox.classList.remove("hidden");
  const now = new Date().toISOString();
  logText.textContent += `[${now}] ${msg}\n`;
  logText.scrollTop = logText.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
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
    writeLog("idToken がありません（ログインからやり直してください）");
    return null;
  }
  return idToken;
}

function renderSourceOptions(list) {
  const groups = {};

  list.forEach((item) => {
    const groupName = item.group || "その他";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(item);
  });

  const html = [`<option value="" selected disabled>選択してください</option>`];

  Object.keys(groups).forEach((groupName) => {
    html.push(`<optgroup label="${escapeHtml(groupName)}">`);
    groups[groupName].forEach((item) => {
      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`
      );
    });
    html.push(`</optgroup>`);
  });

  sourceSelect.innerHTML = html.join("");
}

function resetOpenDataArea() {
  const datasetList = document.getElementById("openDataDatasetList");
  const selectedDataset = document.getElementById("openDataSelectedDataset");
  const resourceList = document.getElementById("openDataResourceList");
  const selectedResource = document.getElementById("openDataSelectedResource");

  if (datasetList) {
    datasetList.innerHTML = `<div class="placeholder">まだ取得していません</div>`;
  }
  if (selectedDataset) {
    selectedDataset.textContent = "未選択";
    selectedDataset.dataset.datasetId = "";
    selectedDataset.dataset.datasetTitle = "";
  }
  if (resourceList) {
    resourceList.innerHTML = `<div class="placeholder">まだ分解していません</div>`;
  }
  if (selectedResource) {
    selectedResource.textContent = "未選択";
    selectedResource.dataset.resourceId = "";
    selectedResource.dataset.resourceName = "";
  }
}

function applySelection(key) {
  const p = sourceMap[key];
  if (!p) {
    if (sourceName) sourceName.value = "";
    showPanelByKey("");
    return;
  }

  if (sourceName) {
    sourceName.value = p.name ?? p.label ?? "";
  }

  if (key === "api_datago") {
    resetOpenDataArea();
  }

  showPanelByKey(key);
}

async function loadSourceMaster() {
  try {
    const res = await fetch("./source_master.json");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    sourceList = await res.json();
    sourceMap = Object.fromEntries(sourceList.map((item) => [item.key, item]));
    renderSourceOptions(sourceList);
  } catch (e) {
    console.error(e);
    if (sourceSelect) {
      sourceSelect.innerHTML = `<option value="" selected disabled>データ種別読込失敗</option>`;
    }
    writeLog(`データ種別読込失敗: ${e.message}`);
  }
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    sessionStorage.removeItem("idToken");
    window.location.href = "index.html";
  });
}

if (btnMenu) {
  btnMenu.addEventListener("click", () => {
    window.location.href = "menu.html";
  });
}

if (btnClearLog) {
  btnClearLog.addEventListener("click", clearLog);
}

if (sourceSelect) {
  sourceSelect.addEventListener("change", () => {
    clearLog();
    applySelection(sourceSelect.value);
  });
}

if (btnKokkaiRegister) {
  btnKokkaiRegister.addEventListener("click", async () => {
    writeLog("国会議事録ボタン押下");

    const p = sourceMap[sourceSelect.value];
    if (!p) {
      writeLog("取得元が選択されていません");
      return;
    }

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceKokkai || typeof window.DataSourceKokkai.run !== "function") {
      writeLog("data_source_kokkai.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceKokkai.run({
        url: p.url,
        method: p.method ?? "POST",
        idToken,
        writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
    }
  });
}

if (btnUploadRegister) {
  btnUploadRegister.addEventListener("click", async () => {
    writeLog("アップロードボタン押下");

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceUpload || typeof window.DataSourceUpload.run !== "function") {
      writeLog("data_source_upload.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceUpload.run({
        apiBase: API_BASE,
        idToken,
        writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
    }
  });
}

if (btnFetchDatasets) {
  btnFetchDatasets.addEventListener("click", async () => {
    writeLog("データセット取得ボタン押下");

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceOpenData || typeof window.DataSourceOpenData.fetchDatasets !== "function") {
      writeLog("data_source_opendata.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceOpenData.fetchDatasets({
        apiBase: API_BASE,
        idToken,
        writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
    }
  });
}

if (btnFetchResources) {
  btnFetchResources.addEventListener("click", async () => {
    writeLog("データセット分解ボタン押下");

    const idToken = requireIdToken();
    if (!idToken) return;

    const selectedDataset = document.getElementById("openDataSelectedDataset");
    const datasetId = selectedDataset?.dataset?.datasetId || "";

    if (!datasetId) {
      writeLog("データセットが未選択です");
      return;
    }

    if (!window.DataSourceOpenData || typeof window.DataSourceOpenData.fetchResources !== "function") {
      writeLog("data_source_opendata.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceOpenData.fetchResources({
        apiBase: API_BASE,
        idToken,
        datasetId,
        writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
    }
  });
}

if (btnRegisterResource) {
  btnRegisterResource.addEventListener("click", async () => {
    writeLog("データ登録ボタン押下");

    const idToken = requireIdToken();
    if (!idToken) return;

    const selectedDataset = document.getElementById("openDataSelectedDataset");
    const selectedResource = document.getElementById("openDataSelectedResource");

    const datasetId = selectedDataset?.dataset?.datasetId || "";
    const resourceId = selectedResource?.dataset?.resourceId || "";

    if (!datasetId) {
      writeLog("データセットが未選択です");
      return;
    }

    if (!resourceId) {
      writeLog("resource が未選択です");
      return;
    }

    if (!window.DataSourceOpenData || typeof window.DataSourceOpenData.registerResource !== "function") {
      writeLog("data_source_opendata.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceOpenData.registerResource({
        apiBase: API_BASE,
        idToken,
        datasetId,
        resourceId,
        writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  hideAllPanels();
  if (panelEmpty) panelEmpty.classList.remove("hidden");
  await loadSourceMaster();
});
