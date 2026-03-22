console.log("data_source.js loaded");

const sourceSelect = document.getElementById("sourceSelect");
const sourceName = document.getElementById("sourceName");

const panelEmpty = document.getElementById("panelEmpty");
const panelKokkai = document.getElementById("panelKokkai");
const panelUpload = document.getElementById("panelUpload");
const panelOpenData = document.getElementById("panelOpenData");
const panelUrl = document.getElementById("panelUrl");
const panelApi = document.getElementById("panelApi");

const publicUrlTarget = document.getElementById("publicUrlTarget");
const publicUrlPageList = document.getElementById("publicUrlPageList");

const logBox = document.getElementById("logBox");
const logText = document.getElementById("logText");

const btnLogout = document.getElementById("btnLogout");
const btnMenu = document.getElementById("btnMenu");
const btnClearLog = document.getElementById("btnClearLog");

const btnKokkaiRegister = document.getElementById("btnKokkaiRegister");
const btnUploadRegister = document.getElementById("btnUploadRegister");
const btnFetchDatasets = document.getElementById("btnFetchDatasets");
const btnUrlRegister = document.getElementById("btnUrlRegister");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let sourceList = [];
let sourceMap = {};
let publicUrlConfigCache = null;

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

  if (sourceSelect) {
    sourceSelect.innerHTML = html.join("");
  }
}

async function loadPublicUrlConfig(forceReload = false) {
  if (!forceReload && publicUrlConfigCache) {
    return publicUrlConfigCache;
  }

  const idToken = requireIdToken();
  if (!idToken) {
    throw new Error("idToken がありません");
  }

  const res = await fetch(`${API_BASE}/public-url/sources`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });

  if (!res.ok) {
    throw new Error(`公開URL設定の取得に失敗しました (HTTP ${res.status})`);
  }

  const config = await res.json();
  publicUrlConfigCache = config;
  return config;
}

function findPublicUrlSource(config, sourceKey) {
  if (!config || !Array.isArray(config.sources)) return null;
  return config.sources.find((item) => item.source_key === sourceKey) || null;
}

function resetPublicUrlArea() {
  if (publicUrlTarget) {
    publicUrlTarget.value = "";
    publicUrlTarget.readOnly = false;
    publicUrlTarget.classList.remove("public-url-readonly");
  }

  if (window.DataSourceUrl && typeof window.DataSourceUrl.resetPages === "function") {
    window.DataSourceUrl.resetPages(publicUrlPageList);
  }
}

async function applySelection(key) {
  const p = sourceMap[key];

  if (!p) {
    if (sourceName) sourceName.value = "";
    resetPublicUrlArea();
    showPanelByKey("");
    return;
  }

  if (sourceName) {
    sourceName.value = p.label ?? "";
  }

  if (p.type === "public_url") {
    if (publicUrlTarget) {
      publicUrlTarget.value = "";
      publicUrlTarget.readOnly = true;
      publicUrlTarget.classList.add("public-url-readonly");
    }

    try {
      const config = await loadPublicUrlConfig();
      const source = findPublicUrlSource(config, key);

      if (!source) {
        if (publicUrlTarget) {
          publicUrlTarget.value = "定義未登録";
        }
        writeLog(`公開URL設定に source_key=${key} がありません`);
      } else {
        const label = source.label ?? "";
        const url = source.url ?? "";

        if (publicUrlTarget) {
          publicUrlTarget.value = label && url ? `${label} (${url})` : (label || url || "");
        }
      }
    } catch (e) {
      console.error(e);
      if (publicUrlTarget) {
        publicUrlTarget.value = "取得設定 読込失敗";
      }
      writeLog(`公開URL設定読込失敗: ${e.message}`);
    }
  } else {
    if (publicUrlTarget) {
      publicUrlTarget.value = "";
      publicUrlTarget.readOnly = false;
      publicUrlTarget.classList.remove("public-url-readonly");
    }
  }

  if (window.DataSourceUrl && typeof window.DataSourceUrl.resetPages === "function") {
    window.DataSourceUrl.resetPages(publicUrlPageList);
  }

  if (key === "api_datago" && window.DataSourceOpenData) {
    window.DataSourceOpenData.resetOpenDataArea();
  }

  showPanelByKey(key);
}

async function loadSourceMaster() {
  try {
    const res = await fetch("./source_master.json", {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error("source_master.json の取得に失敗しました");
    }

    const list = await res.json();

    sourceList = Array.isArray(list) ? list : [];
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
  sourceSelect.addEventListener("change", async () => {
    clearLog();
    await applySelection(sourceSelect.value);
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
        apiBase: API_BASE,
        sourceKey: p.key,
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
    writeLog("データセット取得");

    const p = sourceMap[sourceSelect.value];
    if (!p) {
      writeLog("取得元が選択されていません");
      return;
    }

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceOpenData) {
      writeLog("data_source_opendata.js が読み込まれていません");
      return;
    }

    const loadDatasets = async (silent = false) => {
      const data = await window.DataSourceOpenData.fetchDatasets({
        apiBase: API_BASE,
        sourceKey: p.key,
        idToken,
        writeLog,
        silent
      });

      window.DataSourceOpenData.renderDatasets(
        data.datasets || [],
        {
          onExpandDataset: async (datasetId, datasetTitle) => {
            writeLog(`dataset 分解開始: ${datasetTitle}`);

            await window.DataSourceOpenData.expandDataset({
              apiBase: API_BASE,
              sourceKey: p.key,
              idToken,
              datasetId,
              writeLog
            });

            await loadDatasets(true);
          }
        },
        writeLog
      );
    };

    try {
      await loadDatasets(false);
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
    }
  });
}

if (btnUrlRegister) {
  btnUrlRegister.addEventListener("click", async () => {
    writeLog("公開URL取得ボタン押下");

    const p = sourceMap[sourceSelect.value];
    if (!p) {
      writeLog("取得元が選択されていません");
      return;
    }

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceUrl || typeof window.DataSourceUrl.run !== "function") {
      writeLog("data_source_url.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceUrl.run({
        apiBase: API_BASE,
        sourceKey: p.key,
        idToken,
        writeLog,
        pagesContainer: publicUrlPageList
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
  resetPublicUrlArea();
  await loadSourceMaster();
});
