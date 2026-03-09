console.log("data_source_kokkai.js loaded");

(function () {
  const CONFIG_PATH_MAP = {
    api_kokkai: "/config/kokkai.json"
  };

  function buildRequestUrl(apiBase, url) {
    if (!url) {
      throw new Error("url が指定されていません");
    }

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    if (url.startsWith("/")) {
      return `${apiBase}${url}`;
    }

    return `${apiBase}/${url}`;
  }

  async function readErrorText(res) {
    try {
      const text = await res.text();
      return text || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }

  function getConfigPath(sourceKey) {
    const path = CONFIG_PATH_MAP[sourceKey];
    if (!path) {
      throw new Error(`未対応の sourceKey です: ${sourceKey}`);
    }
    return path;
  }

  async function loadSourceConfig(sourceKey) {
    const configPath = getConfigPath(sourceKey);

    const res = await fetch(configPath, {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`設定JSON取得失敗: ${configPath} / ${text}`);
    }

    return await res.json();
  }

  async function run({ apiBase, sourceKey, idToken, writeLog }) {
    if (!sourceKey) {
      throw new Error("sourceKey が指定されていません");
    }

    const config = await loadSourceConfig(sourceKey);

    writeLog?.("国会議事録 取得開始");
    writeLog?.(`source_key=${sourceKey}`);
    writeLog?.(`config_file=${getConfigPath(sourceKey)}`);

    const requestUrl = buildRequestUrl(apiBase, "/kokkai/fetch_and_register");

    const res = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        source_key: sourceKey,
        config
      })
    });

    if (res.status === 409) {
      const text = await readErrorText(res);
      writeLog?.(`重複または登録済み(409): ${text}`);
      return;
    }

    if (res.status === 401) {
      const text = await readErrorText(res);
      writeLog?.(`認証エラー(401): ${text}`);
      return;
    }

    if (res.status === 403) {
      const text = await readErrorText(res);
      writeLog?.(`権限エラー(403): ${text}`);
      return;
    }

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`取得失敗: ${text}`);
    }

    const data = await res.json();

    writeLog?.("登録完了");

    if (typeof data.fetched === "number") writeLog?.(`fetched=${data.fetched}`);
    if (typeof data.count === "number") writeLog?.(`count=${data.count}`);
    if (typeof data.inserted === "number") writeLog?.(`inserted=${data.inserted}`);
    if (typeof data.skipped === "number") writeLog?.(`skipped=${data.skipped}`);
    if (data.file_id) writeLog?.(`file_id=${data.file_id}`);
    if (data.source_key) writeLog?.(`source_key=${data.source_key}`);
    if (data.requested_url) writeLog?.(`requested_url=${data.requested_url}`);
  }

  window.DataSourceKokkai = {
    run
  };
})();
