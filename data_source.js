console.log("data_source.js loaded");

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
const btnClearLog = document.getElementById("btnClearLog");

const btnKokkaiRegister = document.getElementById("btnKokkaiRegister");
const btnUploadRegister = document.getElementById("btnUploadRegister");
const btnFetchDatasets = document.getElementById("btnFetchDatasets");
const btnUrlRegister = document.getElementById("btnUrlRegister");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let sourceList = [];
let sourceMap = {};
let currentSourceKey = "";
let publicUrlConfigCache = null;

function writeLog(msg) {
  if (!logText) return;

  const line = String(msg ?? "");
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const prefix = `[${hh}:${mm}:${ss}] `;
  logText.textContent += `${prefix}${line}\n`;
  logText.scrollTop = logText.scrollHeight;
}

function clearLog() {
  if (!logText) return;
  logText.textContent = "";
}

function getSourceSelect() {
  return document.getElementById("sourceSelect");
}

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

function getIdToken() {
  return sessionStorage.getItem("idToken");
}

function requireIdToken() {
  const idToken = getIdToken();
  if (!idToken) {
    alert("idToken がありません。ログインからやり直してください。");
    return null;
  }
  return idToken;
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
    if ("value" in publicUrlTarget) {
      publicUrlTarget.value = "";
    } else {
      publicUrlTarget.textContent = "";
    }

    publicUrlTarget.readOnly = false;
    publicUrlTarget.classList.remove("public-url-readonly");
  }

  if (window.DataSourceUrl && typeof window.DataSourceUrl.resetPages === "function") {
    window.DataSourceUrl.resetPages(publicUrlPageList);
  }
}

async function applySelection(key) {
  currentSourceKey = key || "";
  const p = sourceMap[key];

  if (!p) {
    resetPublicUrlArea();
    showPanelByKey("");
    return;
  }

  if (p.type === "public_url") {
    if (publicUrlTarget) {
      if ("value" in publicUrlTarget) {
        publicUrlTarget.value = "";
      } else {
        publicUrlTarget.textContent = "";
      }

      publicUrlTarget.readOnly = true;
      publicUrlTarget.classList.add("public-url-readonly");
    }

    try {
      const config = await loadPublicUrlConfig();
      const source = findPublicUrlSource(config, key);

      if (!source) {
        if (publicUrlTarget) {
          if ("value" in publicUrlTarget) {
            publicUrlTarget.value = "定義未登録";
          } else {
            publicUrlTarget.textContent = "定義未登録";
          }
        }
      } else {
        const label = source.label ?? "";
        const url = source.url ?? "";
        const text = label && url ? `${label}\n${url}` : (label || url || "");

        if (publicUrlTarget) {
          if ("value" in publicUrlTarget) {
            publicUrlTarget.value = text;
          } else {
            publicUrlTarget.textContent = text;
          }
        }
      }
    } catch (e) {
      console.error(e);
      if (publicUrlTarget) {
        if ("value" in publicUrlTarget) {
          publicUrlTarget.value = "取得設定 読込失敗";
        } else {
          publicUrlTarget.textContent = "取得設定 読込失敗";
        }
      }
      alert(`公開URL設定読込失敗: ${e.message}`);
    }
  } else {
    if (publicUrlTarget) {
      if ("value" in publicUrlTarget) {
        publicUrlTarget.value = "";
      } else {
        publicUrlTarget.textContent = "";
      }

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

function bindToolbarEvents() {
  document.addEventListener("toolbar:ready", (event) => {
    const detail = event.detail || {};
    sourceList = Array.isArray(detail.sourceList) ? detail.sourceList : [];
    sourceMap = detail.sourceMap || {};

    hideAllPanels();
    resetPublicUrlArea();

    if (panelEmpty) {
      panelEmpty.classList.remove("hidden");
    }
  });

  document.addEventListener("toolbar:source-change", async (event) => {
    const detail = event.detail || {};
    const sourceKey = detail.sourceKey || "";
    await applySelection(sourceKey);
  });
}

if (btnKokkaiRegister) {
  btnKokkaiRegister.addEventListener("click", async () => {
    const sourceSelect = getSourceSelect();
    const p = sourceMap[sourceSelect?.value || currentSourceKey];
    if (!p) {
      alert("取得元が選択されていません");
      return;
    }

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceKokkai || typeof window.DataSourceKokkai.run !== "function") {
      alert("data_source_kokkai.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceKokkai.run({
        apiBase: API_BASE,
        sourceKey: p.key,
        idToken,
        writeLog: writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
      alert(`処理失敗: ${e.message}`);
    }
  });
}

if (btnUploadRegister) {
  btnUploadRegister.addEventListener("click", async () => {
    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceUpload || typeof window.DataSourceUpload.run !== "function") {
      alert("data_source_upload.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceUpload.run({
        apiBase: API_BASE,
        idToken,
        writeLog: writeLog
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
      alert(`処理失敗: ${e.message}`);
    }
  });
}

if (btnFetchDatasets) {
  btnFetchDatasets.addEventListener("click", async () => {
    const sourceSelect = getSourceSelect();
    const p = sourceMap[sourceSelect?.value || currentSourceKey];
    if (!p) {
      alert("取得元が選択されていません");
      return;
    }

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceOpenData) {
      alert("data_source_opendata.js が読み込まれていません");
      return;
    }

    const loadDatasets = async (silent = false) => {
      const data = await window.DataSourceOpenData.fetchDatasets({
        apiBase: API_BASE,
        sourceKey: p.key,
        idToken,
        writeLog: writeLog,
        silent
      });

      window.DataSourceOpenData.renderDatasets(
        data.datasets || [],
        {
          onExpandDataset: async (datasetId, _datasetTitle) => {
            await window.DataSourceOpenData.expandDataset({
              apiBase: API_BASE,
              sourceKey: p.key,
              idToken,
              datasetId,
              writeLog: writeLog
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
      alert(`処理失敗: ${e.message}`);
    }
  });
}

if (btnUrlRegister) {
  btnUrlRegister.addEventListener("click", async () => {
    const sourceSelect = getSourceSelect();
    const p = sourceMap[sourceSelect?.value || currentSourceKey];
    if (!p) {
      alert("取得元が選択されていません");
      return;
    }

    const idToken = requireIdToken();
    if (!idToken) return;

    if (!window.DataSourceUrl || typeof window.DataSourceUrl.run !== "function") {
      alert("data_source_url.js が読み込まれていません");
      return;
    }

    try {
      await window.DataSourceUrl.run({
        apiBase: API_BASE,
        sourceKey: p.key,
        idToken,
        writeLog: writeLog,
        pagesContainer: publicUrlPageList
      });
    } catch (e) {
      console.error(e);
      writeLog(`処理失敗: ${e.message}`);
      alert(`処理失敗: ${e.message}`);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hideAllPanels();
  if (panelEmpty) panelEmpty.classList.remove("hidden");
  resetPublicUrlArea();
  bindToolbarEvents();
});
