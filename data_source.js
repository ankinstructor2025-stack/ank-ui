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

let sourceList = [];
let sourceMap = {};

function showOnly(kind) {
  commonFields.classList.remove("hidden");
  actions.classList.remove("hidden");

  formApi.classList.add("hidden");
  formUrl.classList.add("hidden");
  formFile.classList.add("hidden");

  if (kind === "api") formApi.classList.remove("hidden");
  if (kind === "url") formUrl.classList.remove("hidden");
  if (kind === "file") formFile.classList.remove("hidden");
}

function writeLog(msg) {
  logBox.classList.remove("hidden");
  const now = new Date().toISOString();
  logText.textContent += `[${now}] ${msg}\n`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

document.addEventListener("DOMContentLoaded", async () => {
  await loadSourceMaster();
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
    sourceSelect.innerHTML = `<option value="" selected disabled>データ種別読込失敗</option>`;
    writeLog(`データ種別読込失敗: ${e.message}`);
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

  const html = [`<option value="" selected disabled>選択してください</option>`];

  Object.keys(groups).forEach(groupName => {
    html.push(`<optgroup label="${escapeHtml(groupName)}">`);
    groups[groupName].forEach(item => {
      html.push(
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}<\/option>`
      );
    });
    html.push(`</optgroup>`);
  });

  sourceSelect.innerHTML = html.join("");
}

sourceSelect.addEventListener("change", () => {
  const key = sourceSelect.value;
  const p = sourceMap[key];
  if (!p) return;

  document.getElementById("sourceName").value = p.name ?? p.label ?? "";

  if (p.type === "public_api") {
    showOnly("api");
    document.getElementById("apiEndpoint").value = p.templatePath ?? "";
    document.getElementById("apiParams").value = `params は ${p.templatePath ?? ""} を参照`;
  }

  if (p.type === "public_url") {
    showOnly("url");
    document.getElementById("targetUrl").value = p.templatePath ?? "";
    document.getElementById("urlMode").value = p.mode ?? "html";
    document.getElementById("urlHint").value = p.hint ?? "";
  }

  if (p.type === "file") {
    showOnly("file");
  }

  logText.textContent = "";
  logBox.classList.add("hidden");
});

if (!btnRegister) {
  console.warn("btnRegister not found");
} else {
  btnRegister.addEventListener("click", async () => {
    const key = sourceSelect.value;
    const p = sourceMap[key];
    const idToken = sessionStorage.getItem("idToken");

    writeLog(`key=${key}`);
    writeLog(`uploadFileInput exists=${!!document.getElementById("uploadFileInput")}`);
    writeLog(`idToken exists=${!!idToken}`);

    if (!key || !p) {
      writeLog("取得テスト対象が選択されていません");
      return;
    }

    switch (key) {
      case "api_kokkai": {
        if (!p.url) {
          writeLog("取得テスト対象の url がありません");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        try {
          const res = await fetch(p.url, {
            method: p.method ?? "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`
            }
          });

          if (res.status === 409) {
            const data = await res.json()
            log("既に登録済みのデータです")
            return
          }

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();

          if (typeof data.count === "number") {
            writeLog(`取得成功 件数=${data.count}`);
          } else {
            writeLog("取得成功（countなし）");
          }
        } catch (e) {
          console.error(e);
          writeLog(`取得失敗: ${e.message}`);
        }
        return;
      }

      case "api_datago": {
        if (!p.url) {
          writeLog("取得テスト対象の url がありません");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        try {
          const res = await fetch(p.url, {
            method: p.method ?? "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`
            }
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();

          if (typeof data.count === "number") {
            writeLog(`取得成功 件数=${data.count}`);
          } else {
            writeLog("取得成功（countなし）");
          }
        } catch (e) {
          console.error(e);
          writeLog(`取得失敗: ${e.message}`);
        }
        return;
      }

      case "url_egov": {
        if (!p.url) {
          writeLog("e-Gov は url が未設定です");
          return;
        }

        writeLog(`${p.label ?? p.name} 登録開始`);

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        try {
          const res = await fetch(p.url, {
            method: p.method ?? "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`
            }
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          writeLog("登録完了");
          writeLog(`fetched=${data.fetched ?? 0}`);
          writeLog(`inserted=${data.inserted ?? 0}`);
          writeLog(`skipped=${data.skipped ?? 0}`);
          if (data.file_id) {
            writeLog(`file_id=${data.file_id}`);
          }
        } catch (e) {
          console.error(e);
          writeLog(`登録失敗: ${e.message}`);
        }
        return;
      }

      case "url_caa": {
        if (!p.url) {
          writeLog("消費者庁は url が未設定です");
          return;
        }

        writeLog(`${p.label ?? p.name} 登録開始`);

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        try {
          const res = await fetch(p.url, {
            method: p.method ?? "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`
            }
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          writeLog("登録完了");
          writeLog(`fetched=${data.fetched ?? 0}`);
          writeLog(`inserted=${data.inserted ?? 0}`);
          writeLog(`skipped=${data.skipped ?? 0}`);
          if (data.file_id) {
            writeLog(`file_id=${data.file_id}`);
          }
        } catch (e) {
          console.error(e);
          writeLog(`登録失敗: ${e.message}`);
        }
        return;
      }

      case "file_upload": {
        const input = document.getElementById("uploadFileInput");

        if (!input || !input.files || input.files.length === 0) {
          writeLog("アップロードするファイルを選択してください");
          return;
        }

        const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        const file = input.files[0];

        writeLog(`アップロード開始: ${file.name}`);

        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(`${API_BASE}/upload_and_register`, {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
            body: formData
          });

          if (res.status === 409) {
            writeLog("同名ファイルはアップロードできません");
            return;
          }
          if (res.status === 401) {
            const t = await res.text();
            writeLog(`認証エラー(401): ${t}`);
            return;
          }
          if (res.status === 403) {
            const t = await res.text();
            writeLog(`権限エラー(403): ${t}`);
            return;
          }
          if (!res.ok) {
            const t = await res.text();
            throw new Error(`HTTP ${res.status}: ${t}`);
          }

          const data = await res.json();

          writeLog("アップロード成功");
          writeLog(`file_id=${data.file_id}`);

          writeLog("row_data 取り込み開始");

          const res2 = await fetch(`${API_BASE}/ingest_uploaded_file/${data.file_id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` }
          });

          if (res2.status === 409) {
            const t = await res2.text();
            writeLog(`取り込みスキップ(409): ${t}`);
            return;
          }
          if (res2.status === 401) {
            const t = await res2.text();
            writeLog(`認証エラー(401): ${t}`);
            return;
          }
          if (!res2.ok) {
            const t = await res2.text();
            throw new Error(`HTTP ${res2.status}: ${t}`);
          }

          const ingest = await res2.json();

          writeLog("row_data 取り込み成功");
          if (typeof ingest.row_count === "number") {
            writeLog(`row_count=${ingest.row_count}`);
          }

          writeLog("完了");
        } catch (e) {
          console.error(e);
          writeLog(`アップロード/取り込み失敗: ${e.message}`);
        }
        return;
      }

      default:
        writeLog(`未対応の取得元です: ${key}`);
        return;
    }
  });
}
