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
    panelEmpty.classList.remove("hidden");
    return;
  }

  if (key === "api_kokkai") {
    panelKokkai.classList.remove("hidden");
    return;
  }

  if (key === "file_upload") {
    panelUpload.classList.remove("hidden");
    return;
  }

  if (key === "api_datago") {
    panelOpenData.classList.remove("hidden");
    return;
  }

  if (p.type === "public_url") {
    panelUrl.classList.remove("hidden");
    return;
  }

  if (p.type === "public_api") {
    panelApi.classList.remove("hidden");
    return;
  }

  panelEmpty.classList.remove("hidden");
}

function clearLog() {

  if (logText) logText.textContent = "";
  if (logBox) logBox.classList.add("hidden");

}

function writeLog(msg) {

  logBox.classList.remove("hidden");

  const now = new Date().toISOString();

  logText.textContent += `[${now}] ${msg}\n`;

  logText.scrollTop = logText.scrollHeight;

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

    html.push(`<optgroup label="${groupName}">`);

    groups[groupName].forEach((item) => {

      html.push(`<option value="${item.key}">${item.label}</option>`);

    });

    html.push(`</optgroup>`);

  });

  sourceSelect.innerHTML = html.join("");

}

async function loadSourceMaster() {

  try {

    const res = await fetch("./source_master.json", { cache: "no-store" });

    sourceList = await res.json();

    sourceMap = Object.fromEntries(

      sourceList.map((item) => [item.key, item])

    );

    renderSourceOptions(sourceList);

  }

  catch (e) {

    console.error(e);

    writeLog(`データ種別読込失敗: ${e.message}`);

  }

}

function applySelection(key) {

  const p = sourceMap[key];

  if (!p) {

    sourceName.value = "";

    showPanelByKey("");

    return;

  }

  sourceName.value = p.label ?? "";

  if (key === "api_datago" && window.DataSourceOpenData) {

    window.DataSourceOpenData.resetOpenDataArea();

  }

  showPanelByKey(key);

}

if (sourceSelect) {

  sourceSelect.addEventListener("change", () => {

    clearLog();

    applySelection(sourceSelect.value);

  });

}

/* ---------------------------------
   OpenData
--------------------------------- */

if (btnFetchDatasets) {

  btnFetchDatasets.addEventListener("click", async () => {

    writeLog("データセット取得");

    const p = sourceMap[sourceSelect.value];

    const idToken = requireIdToken();

    if (!idToken) return;

    const loadDatasets = async () => {

      const data = await window.DataSourceOpenData.fetchDatasets({

        apiBase: API_BASE,

        idToken,

        writeLog

      });

      window.DataSourceOpenData.renderDatasets(

        data.datasets || [],

        {

          onExpandDataset: async (datasetId, datasetTitle) => {

            writeLog(`dataset 分解開始: ${datasetTitle}`);

            await window.DataSourceOpenData.expandDataset({

              apiBase: API_BASE,

              idToken,

              datasetId,

              writeLog

            });

            await loadDatasets();

          }

        },

        writeLog

      );

    };

    try {

      await loadDatasets();

    }

    catch (e) {

      console.error(e);

      writeLog(`処理失敗: ${e.message}`);

    }

  });

}

document.addEventListener("DOMContentLoaded", async () => {

  hideAllPanels();

  panelEmpty.classList.remove("hidden");

  await loadSourceMaster();

});
