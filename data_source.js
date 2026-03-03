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
// -------------------------------
// プリセット（HTMLの option value とキーを一致させる）
// -------------------------------
const preset = {
  // 公開API
  api_kokkai: {
    type: "public_api",
    name: "国会会議録API（国会議事録）",
    endpoint: "https://kokkai.ndl.go.jp/api/meeting",
    params: { any: "AI", maximumRecords: 200 },
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/kokkai/test",
    testLabel: "国会議事録"
  },

  api_datago: {
    type: "public_api",
    name: "data.go.jp（政府オープンデータ）",
    endpoint: "https://www.data.go.jp/data/api/action",
    params: { action: "package_list", limit: 5 },
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/opendata/test",
    testLabel: "data.go.jp"
  },

  api_jma: {
    type: "public_api",
    name: "気象庁（防災・気象）",
    endpoint: "https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json",
    params: {}, // GET想定なら空でOK（デモ用）
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/jma/test",
    testLabel: "気象庁"
  },

  // 公開URL
  url_egov: {
    type: "public_url",
    name: "e-Gov（法令・制度ページ）",
    url: "https://elaws.e-gov.go.jp/",
    mode: "html",
    hint: "法令検索 / 見出し",
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/egov/test",
    testLabel: "e-Gov"
  },

  url_caa: {
    type: "public_url",
    name: "消費者庁（FAQページ）",
    url: "https://www.caa.go.jp/policies/policy/consumer_policy/",
    mode: "html",
    hint: "FAQ",
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/caa/test",
    testLabel: "消費者庁"
  },

  url_tokyo: {
    type: "public_url",
    name: "東京都（オープン情報ページ）",
    url: "https://www.metro.tokyo.lg.jp/",
    mode: "html",
    hint: "",
    testUrl: "https://ank-api-986862757498.asia-northeast1.run.app/v1/tokyo/test",
    testLabel: "東京都"
  },

  // ダウンロード
  file_upload: {
    type: "file",
    name: "ファイルアップロード（csv/txt/json）"
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
    document.getElementById("apiParams").value = JSON.stringify(p.params ?? {}, null, 2);
  }

  if (p.type === "public_url") {
    showOnly("url");
    document.getElementById("targetUrl").value = p.url ?? "";
    document.getElementById("urlMode").value = p.mode ?? "html";
    document.getElementById("urlHint").value = p.hint ?? "";
  }

  if (p.type === "file") {
    showOnly("file");
  }

  logText.textContent = "";
  logBox.classList.add("hidden");
});

// -------------------------------
// 国会議事録 取得テスト
// -------------------------------
btnTest.addEventListener("click", async () => {
  writeLog(`key=${key}`);
  writeLog(`uploadFileInput exists=${!!document.getElementById("uploadFileInput")}`);
  writeLog(`idToken exists=${typeof idToken !== "undefined" && !!idToken}`);

  const key = sourceSelect.value;
  const p = preset[key];

  if (!key || !p) {
    writeLog("取得テスト対象が選択されていません（preset がありません）");
    return;
  }

  switch (key) {
    // -------------------------------
    // 国会議事録：現状動作を壊さない（あなたのコードそのまま）
    // -------------------------------
    case "api_kokkai": {
      if (!p || !p.testUrl) {
        writeLog("取得テスト対象が選択されていません（preset.testUrl がありません）");
        return;
      }

      writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

      try {
        const res = await fetch(p.testUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (typeof data.count === "number") writeLog(`取得成功 件数=${data.count}`);
        else writeLog(`取得成功（countなし）`);

      } catch (e) {
        console.error(e);
        writeLog(`取得失敗: ${e.message}`);
      }
      return;
    }

    // -------------------------------
    // data.go.jp（e-Gov CKAN）：添付 opendata_test.py の /opendata/test を叩く
    // ※GETで {count, dataset_ids} が返る :contentReference[oaicite:2]{index=2}
    // -------------------------------
    case "api_datago": {
      if (!p.testUrl) {
        writeLog("data.go.jp は testUrl が未設定です（/opendata/test を設定してください）");
        return;
      }

      writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

      try {
        const res = await fetch(p.testUrl, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (typeof data.count === "number") writeLog(`取得成功 件数=${data.count}`);
        else writeLog(`取得成功（countなし）`);

      } catch (e) {
        console.error(e);
        writeLog(`取得失敗: ${e.message}`);
      }
      return;
    }
    
    case "api_jma": {
      if (!p.testUrl) {
        writeLog("気象庁は取得テスト未実装です（preset.testUrl を設定してください）");
        return;
      }

      writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

      try {
        const res = await fetch(p.testUrl, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (typeof data.count === "number") writeLog(`取得成功 件数=${data.count}`);
        else writeLog("取得成功（countなし）");

      } catch (e) {
        console.error(e);
        writeLog(`取得失敗: ${e.message}`);
      }
      return;
    }

    case "url_egov": {
      if (!p.testUrl) {
        writeLog("e-Gov は取得テスト未実装です（preset.testUrl を設定してください）");
        return;
      }

      writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

      try {
        const res = await fetch(p.testUrl, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (typeof data.count === "number") writeLog(`取得成功 件数=${data.count}`);
        else writeLog("取得成功（countなし）");

        if (typeof data.bytes === "number") writeLog(`HTMLサイズ bytes=${data.bytes}`);
      } catch (e) {
        console.error(e);
        writeLog(`取得失敗: ${e.message}`);
      }
      return;
    }

    case "url_caa": {
      if (!p.testUrl) {
        writeLog("消費者庁は取得テスト未実装です（preset.testUrl を設定してください）");
        return;
      }

      writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

      try {
        const res = await fetch(p.testUrl, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (typeof data.count === "number") writeLog(`取得成功 件数=${data.count}`);
        if (typeof data.bytes === "number") writeLog(`HTMLサイズ bytes=${data.bytes}`);

      } catch (e) {
        console.error(e);
        writeLog(`取得失敗: ${e.message}`);
      }
      return;
    }

    case "url_tokyo": {
      if (!p.testUrl) {
        writeLog("東京都は取得テスト未実装です（preset.testUrl を設定してください）");
        return;
      }

      writeLog(`${p.testLabel ?? p.name} 取得テスト開始`);

      try {
        const res = await fetch(p.testUrl, { method: "GET" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (typeof data.count === "number") writeLog(`取得成功 件数=${data.count}`);
        if (typeof data.bytes === "number") writeLog(`HTMLサイズ bytes=${data.bytes}`);
      } catch (e) {
        console.error(e);
        writeLog(`取得失敗: ${e.message}`);
      }
      return;
    }

    case "file_upload": {
      const input = document.getElementById("uploadFileInput");

      if (!input || !input.files || input.files.length === 0) {
        writeLog("アップロードするファイルを選択してください");
        return;
      }

      if (!idToken) {
        writeLog("idToken がありません（ログイン済みか確認してください）");
        return;
      }

      const file = input.files[0];

      writeLog(`アップロード開始: ${file.name}`);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(
          "https://ank-api-986862757498.asia-northeast1.run.app/v1/upload_and_register",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
            body: formData
          }
        );

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

      } catch (e) {
        console.error(e);
        writeLog(`アップロード失敗: ${e.message}`);
      }

      return;
    }

    default: {
      writeLog(`この取得元は取得テスト未実装です: ${key}`);
      return;
    }
  }
});
