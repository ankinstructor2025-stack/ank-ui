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
    params: { keyword: "AI", maximumRecords: 200 }
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

  writeLog("国会議事録 取得テスト開始");

  try {

    const res = await fetch(
      "https://ank-api-986862757498.asia-northeast1.run.app/v1/kokkai/test",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    writeLog(`取得成功 件数=${data.count}`);

  } catch (e) {
    console.error(e);
    writeLog(`取得失敗: ${e.message}`);
  }
});
