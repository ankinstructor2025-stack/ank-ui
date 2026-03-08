console.log("data_source_kokkai.js loaded");

(function () {
  async function readErrorText(res) {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  async function run({ url, method = "POST", idToken, writeLog }) {
    if (!url) {
      writeLog("国会議事録の url が未設定です");
      return;
    }

    writeLog("国会議事録 取得開始");

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      }
    });

    if (res.status === 409) {
      const text = await readErrorText(res);
      writeLog(`重複または登録済み(409): ${text}`);
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
      throw new Error(`取得失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("登録完了");

    if (typeof data.fetched === "number") {
      writeLog(`fetched=${data.fetched}`);
    }
    if (typeof data.count === "number") {
      writeLog(`count=${data.count}`);
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
    if (data.source_key) {
      writeLog(`source_key=${data.source_key}`);
    }
    if (data.requested_url) {
      writeLog(`requested_url=${data.requested_url}`);
    }
  }

  window.DataSourceKokkai = {
    run
  };
})();
