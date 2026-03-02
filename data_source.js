// ===============================
// data_source.js
// ===============================

console.log("data_source.js loaded");

// -------------------------------
// DOM取得
// -------------------------------
const sourceSelect = document.getElementById("sourceSelect");
const commonFields = document.getElementById("commonFields");
const formApi = document.getElementById("formApi");
const formUrl = document.getElementById("formUrl");
const formFile = document.getElementById("formFile");
const actions = document.getElementById("actions");
const logBox = document.getElementById("logBox");
const logText = document.getElementById("logText");

const btnTest = document.getElementById("btnTest");

// -------------------------------
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

// -------------------------------
function writeLog(msg) {

  logBox.classList.remove("hidden");

  const now = new Date().toISOString();
  logText.textContent += `[${now}] ${msg}\n`;
}

// -------------------------------
// プリセット
// -------------------------------
const preset = {
  api_kokkai: {
    type: "public_api",
    name: "国会会議録API（国会議事録）",
    endpoint: "https://kokkai.ndl.go.jp/api/meeting",
    params: { any: "AI", maximumRecords: 200 },

    // ★追加：テスト用（Cloud Run 側）
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/kokkai/test",
    testLabel: "国会議事録"
  },

  // ★追加
  api_digital_agency: {
    type: "public_api",
    name: "デジタル庁オープンデータ（e-Gov CKAN）",
    endpoint: "https://data.e-gov.go.jp/data/api/action",
    params: { action: "package_list", limit: 5 }, // 画面表示用の雰囲気だけ

    // ★テスト用（Cloud Run 側）
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/opendata/test",
    testLabel: "オープンデータ"
  }
};
// -------------------------------
sourceSelect.addEventListener("change", () => {

  const key = sourceSelect.value;
  const p = preset[key];
  if (!p) return;

  document.getElementById("sourceName").value = p.name;

  if (p.type === "public_api") {
    showOnly("api");

    document.getElementById("apiEndpoint").value = p.endpoint;
    document.getElementById("apiParams").value =
      JSON.stringify(p.params, null, 2);
  }

  logText.textContent = "";
  logBox.classList.add("hidden");
});

// -------------------------------
// 国会議事録 取得テスト
// -------------------------------
btnTest.addEventListener("click", async () => {

  const key = sourceSelect.value;
  const p = preset[key];

  if (!p || !p.testUrl) {
    writeLog("取得テスト対象が選択されていません（preset.testUrl がありません）");
    return;
  }

  writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

  try {
    const res = await fetch(p.testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    // opendata/test は {count, dataset_ids} を返す想定
    // kokkai/test は {count, ...} を返す想定
    if (typeof data.count === "number") {
      writeLog(`取得成功 件数=${data.count}`);
    } else {
      writeLog(`取得成功（countなし）`);
    }

  } catch (e) {
    console.error(e);
    writeLog(`取得失敗: ${e.message}`);
  }
});
