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

const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");

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
// ログアウト（index.htmlへ遷移）
// -------------------------------
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    // 最小：idTokenだけ削除して index.html に戻す
    sessionStorage.removeItem("idToken");
    window.location.href = "index.html";
  });
}

// -------------------------------
// プリセット（HTMLの option value とキーを一致させる）
// -------------------------------
const preset = {
  // 公開API
  api_kokkai: {
    type: "public_api",
    name: "国会会議録API（国会議事録）",
    templatePath: "template/kokkai.json",
    url: "https://ank-api-986862757498.asia-northeast1.run.app/v1/kokkai/fetch",
    label: "国会議事録"
  },

  api_datago: {
    type: "public_api",
    name: "data.go.jp（政府オープンデータ）",
    templatePath: "template/opendata.json",
    url: "https://ank-api-986862757498.asia-northeast1.run.app/v1/opendata/fetch",
    label: "data.go.jp"
  },

  api_jma: {
    type: "public_api",
    name: "気象庁（防災・気象）",
    endpoint: "https://www.jma.go.jp/bosai/forecast/data/overview_forecast/130000.json",
    params: {},
    url: "https://ank-api-986862757498.asia-northeast1.run.app/v1/jma/fetch",
    label: "気象庁"
  },

  // 公開URL
  url_egov: {
    type: "public_url",
    name: "e-Gov（法令・制度ページ）",
    url: "https://elaws.e-gov.go.jp/",
    mode: "html",
    hint: "法令検索 / 見出し",
    url: "https://ank-api-986862757498.asia-northeast1.run.app/v1/egov/fetch",
    label: "e-Gov"
  },

  url_caa: {
    type: "public_url",
    name: "消費者庁（FAQページ）",
    url: "https://www.caa.go.jp/policies/policy/consumer_policy/",
    mode: "html",
    hint: "FAQ",
    url: "https://ank-api-986862757498.asia-northeast1.run.app/v1/caa/fetch",
    label: "消費者庁"
  },

  url_tokyo: {
    type: "public_url",
    name: "東京都（オープン情報ページ）",
    url: "https://www.metro.tokyo.lg.jp/",
    mode: "html",
    hint: "",
    url: "https://ank-api-986862757498.asia-northeast1.run.app/v1/tokyo/fetch",
    label: "東京都"
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

    // 国会議事録は template 管理
    if (key === "api_kokkai" || key === "api_datago") {
      document.getElementById("apiEndpoint").value = p.templatePath ?? "";
      document.getElementById("apiParams").value = "params は template/kokkai.json を参照";
    } else {
      document.getElementById("apiEndpoint").value = p.endpoint ?? "";
      document.getElementById("apiParams").value =
        JSON.stringify(p.params ?? {}, null, 2);
    }
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

  // ログ初期化
  logText.textContent = "";
  logBox.classList.add("hidden");
});

// -------------------------------
// （旧）取得テスト → （新）登録ボタンで実行
// -------------------------------
if (!btnRegister) {
  console.warn("btnRegister not found");
} else {
  btnRegister.addEventListener("click", async () => {
    const key = sourceSelect.value;
    const p = preset[key];
    const idToken = sessionStorage.getItem("idToken");

    writeLog(`key=${key}`);
    writeLog(`uploadFileInput exists=${!!document.getElementById("uploadFileInput")}`);
    writeLog(`idToken exists=${!!idToken}`);

    if (!key || !p) {
      writeLog("取得テスト対象が選択されていません（preset がありません）");
      return;
    }

    switch (key) {
      // -------------------------------
      // 国会議事録：現状動作を壊さない（あなたのコードそのまま）
      // -------------------------------
      case "api_kokkai": {
        if (!p || !p.url) {
          writeLog("取得テスト対象が選択されていません（preset.url がありません）");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        try {
          const res = await fetch(p.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }
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
      // data.go.jp（e-Gov CKAN）：添付 opendata_fetch.py の /opendata/fetch を叩く
      // -------------------------------
      case "api_datago": {
        if (!p || !p.url) {
          writeLog("取得テスト対象が選択されていません（preset.url がありません）");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        try {
          const res = await fetch(p.url, {
            method: "GET", // ←APIがGETならGETのまま。POST化するならここをPOSTに
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`
            }
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
      // 気象庁（防災・気象）：/jma/fetch を叩く
      // -------------------------------
      case "api_jma": {
        if (!p.url) {
          writeLog("気象庁は url が未設定です（/jma/fetch を設定してください）");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        try {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (typeof data.bytes === "number") writeLog(`取得成功 bytes=${data.bytes}`);
          else writeLog(`取得成功（bytesなし）`);

        } catch (e) {
          console.error(e);
          writeLog(`取得失敗: ${e.message}`);
        }
        return;
      }

      // -------------------------------
      // e-Gov：/egov/fetch を叩く
      // -------------------------------
      case "url_egov": {
        if (!p.url) {
          writeLog("e-Gov は url が未設定です（/egov/fetch を設定してください）");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        try {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (typeof data.bytes === "number") writeLog(`取得成功 bytes=${data.bytes}`);
          else writeLog(`取得成功（bytesなし）`);

        } catch (e) {
          console.error(e);
          writeLog(`取得失敗: ${e.message}`);
        }
        return;
      }

      // -------------------------------
      // 消費者庁 FAQ：/caa/fetch を叩く
      // -------------------------------
      case "url_caa": {
        if (!p.url) {
          writeLog("消費者庁は url が未設定です（/caa/fetch を設定してください）");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        try {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (typeof data.bytes === "number") writeLog(`取得成功 bytes=${data.bytes}`);
          else writeLog(`取得成功（bytesなし）`);

        } catch (e) {
          console.error(e);
          writeLog(`取得失敗: ${e.message}`);
        }
        return;
      }

      // -------------------------------
      // 東京都：/tokyo/fetch を叩く
      // -------------------------------
      case "url_tokyo": {
        if (!p.url) {
          writeLog("東京都は url が未設定です（/tokyo/fetch を設定してください）");
          return;
        }

        writeLog(`${p.label ?? p.name} 取得テスト開始`);

        try {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          if (typeof data.bytes === "number") writeLog(`取得成功 bytes=${data.bytes}`);
          else writeLog(`取得成功（bytesなし）`);

        } catch (e) {
          console.error(e);
          writeLog(`取得失敗: ${e.message}`);
        }
        return;
      }

      // -------------------------------
      // ファイルアップロード：upload_and_register → ingest_uploaded_file
      // -------------------------------
      case "file_upload": {
        const input = document.getElementById("uploadFileInput");

        if (!input || !input.files || input.files.length === 0) {
          writeLog("アップロードするファイルを選択してください");
          return;
        }

        const API_BASE = "https://ank-api-986862757498.asia-northeast1.run.app/v1";

        const idToken = sessionStorage.getItem("idToken");
        if (!idToken) {
          writeLog("idToken がありません（ログインからやり直してください）");
          return;
        }

        const file = input.files[0];

        writeLog(`アップロード開始: ${file.name}`);

        const formData = new FormData();
        formData.append("file", file);

        try {
          // 1) upload_and_register
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

          // 2) ingest_uploaded_file
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
