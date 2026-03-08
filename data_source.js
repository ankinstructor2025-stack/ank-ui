console.log("data_source.js loaded");

const sourceSelect = document.getElementById("sourceSelect");
const commonFields = document.getElementById("commonFields");
const formApi = document.getElementById("formApi");
const formUrl = document.getElementById("formUrl");
const formFile = document.getElementById("formFile");
const actions = document.getElementById("actions");
const logBox = document.getElementById("logBox");
const logText = document.getElementById("logText");

const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");
const btnMenu = document.getElementById("btnMenu");

const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

let sourceList = [];
let sourceMap = {};

function showOnly(kind) {
  if (commonFields) commonFields.classList.remove("hidden");
  if (actions) actions.classList.remove("hidden");

  if (formApi) formApi.classList.add("hidden");
  if (formUrl) formUrl.classList.add("hidden");
  if (formFile) formFile.classList.add("hidden");

  if (kind === "api" && formApi) formApi.classList.remove("hidden");
  if (kind === "url" && formUrl) formUrl.classList.remove("hidden");
  if (kind === "file" && formFile) formFile.classList.remove("hidden");
}

function resetForms() {
  const sourceName = document.getElementById("sourceName");
  const apiEndpoint = document.getElementById("apiEndpoint");
  const apiParams = document.getElementById("apiParams");
  const targetUrl = document.getElementById("targetUrl");
  const urlMode = document.getElementById("urlMode");
  const urlHint = document.getElementById("urlHint");
  const uploadFileInput = document.getElementById("uploadFileInput");

  if (sourceName) sourceName.value = "";
  if (apiEndpoint) apiEndpoint.value = "";
  if (apiParams) apiParams.value = "";
  if (targetUrl) targetUrl.value = "";
  if (urlMode) urlMode.value = "html";
  if (urlHint) urlHint.value = "";
  if (uploadFileInput) uploadFileInput.value = "";
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

async function readErrorText(res) {
  try {
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function callSimpleApi(p, idToken) {
  const method = p.method ?? "POST";

  const headers = {
    Authorization: `Bearer ${idToken}`
  };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(p.url, {
    method,
    headers
  });

  if (res.status === 409) {
    const text = await readErrorText(res);
    writeLog(`登録済みまたは重複(409): ${text}`);
    return;
  }

  if (res.status === 401) {
    const text = await readErrorText(res);
    writeLog(`認証エラー(401): ${text}`);
    return;
  }

  if (res.status === 403) {
    const text = await readErrorText(res);
    writeLog(`権限エラー(403): ${text}`);
    return;
  }

  if (!res.ok) {
    const text = await readErrorText(res);
    throw new Error(text);
  }

  const data = await res.json();

  if (typeof data.count === "number") {
    writeLog(`count=${data.count}`);
  }
  if (typeof data.fetched === "number") {
    writeLog(`fetched=${data.fetched}`);
  }
  if (typeof data.inserted === "number") {
    writeLog(`inserted=${data.inserted}`);
  }
  if (typeof data.skipped === "number") {
    writeLog(`skipped=${data.skipped}`);
  }
  if (data.file_id) {
    writeLog(`file_id=${data.file_id}`);
  }
  if (data.source_id) {
    writeLog(`source_id=${data.source_id}`);
  }
}

function renderSourceOptions(list) {
  const groups = {};

  list.forEach((item) => {
    const groupName = item.group || "その他";
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
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

function applySelection(key) {
  const p = sourceMap[key];
  if (!p) return;

  const sourceName = document.getElementById("sourceName");
  const apiEndpoint = document.getElementById("apiEndpoint");
  const apiParams = document.getElementById("apiParams");
  const targetUrl = document.getElementById("targetUrl");
  const urlMode = document.getElementById("urlMode");
  const urlHint = document.getElementById("urlHint");

  if (sourceName) {
    sourceName.value = p.name ?? p.label ?? "";
  }

  if (p.type === "public_api") {
    showOnly("api");
    if (apiEndpoint) apiEndpoint.value = p.templatePath ?? "";
    if (apiParams) apiParams.value = `params は ${p.templatePath ?? ""} を参照`;
    return;
  }

  if (p.type === "public_url") {
    showOnly("url");
    if (targetUrl) targetUrl.value = p.templatePath ?? "";
    if (urlMode) urlMode.value = p.mode ?? "html";
    if (urlHint) urlHint.value = p.hint ?? "";
    return;
  }

  if (p.type === "file") {
    showOnly("file");
    return;
  }

  showOnly("api");
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
    sourceSelect.innerHTML = `<option value="" selected disabled>データ種別読込失敗</option>`;
    writeLog(`データ種別読込失敗: ${e.message}`);
  }
}

async function handleRegisterClick() {
  const key = sourceSelect?.value;
  const p = sourceMap[key];

  writeLog(`key=${key || "(未選択)"}`);

  if (!key || !p) {
    writeLog("取得元が選択されていません");
    return;
  }

  const idToken = requireIdToken();
  if (!idToken) return;

  try {
    switch (key) {
      case "file_upload": {
        if (!window.DataSourceUpload || typeof window.DataSourceUpload.run !== "function") {
          writeLog("data_source_upload.js が読み込まれていません");
          return;
        }
        await window.DataSourceUpload.run({
          apiBase: API_BASE,
          idToken,
          writeLog
        });
        return;
      }

      case "api_kokkai": {
        if (!window.DataSourceKokkai || typeof window.DataSourceKokkai.run !== "function") {
          writeLog("data_source_kokkai.js が読み込まれていません");
          return;
        }
        await window.DataSourceKokkai.run({
          url: p.url,
          method: p.method ?? "POST",
          idToken,
          writeLog
        });
        return;
      }

      case "api_datago": {
        if (!p.url) {
          writeLog("オープンデータの url が未設定です");
          return;
        }
        writeLog(`${p.label ?? p.name} は別画面または別ボタン対応に切り出す予定です`);
        return;
      }

      case "url_egov":
      case "url_caa": {
        if (!p.url) {
          writeLog("URL取得先の url が未設定です");
          return;
        }

        writeLog(`${p.label ?? p.name} 登録開始`);
        await callSimpleApi(p, idToken);
        writeLog("登録完了");
        return;
      }

      default: {
        if (!p.url) {
          writeLog(`未対応の取得元です: ${key}`);
          return;
        }

        writeLog(`${p.label ?? p.name} 実行開始`);
        await callSimpleApi(p, idToken);
        writeLog("完了");
      }
    }
  } catch (e) {
    console.error(e);
    writeLog(`処理失敗: ${e.message}`);
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

if (sourceSelect) {
  sourceSelect.addEventListener("change", () => {
    clearLog();
    applySelection(sourceSelect.value);
  });
}

if (btnRegister) {
  btnRegister.addEventListener("click", handleRegisterClick);
} else {
  console.warn("btnRegister not found");
}

document.addEventListener("DOMContentLoaded", async () => {
  resetForms();
  await loadSourceMaster();
});
