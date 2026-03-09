console.log("data_source_kokkai.js loaded");

(function () {

  function buildRequestUrl(apiBase, path) {
    if (!path) {
      throw new Error("path が指定されていません");
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    if (path.startsWith("/")) {
      return `${apiBase}${path}`;
    }

    return `${apiBase}/${path}`;
  }

  async function run({ apiBase, sourceKey, idToken, writeLog }) {
    if (!sourceKey) {
      throw new Error("sourceKey が指定されていません");
    }

    writeLog?.("国会議事録取得開始");

    const requestUrl = buildRequestUrl(apiBase, "/kokkai/fetch_and_register");

    const headers = {
      "Content-Type": "application/json"
    };

    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_key: sourceKey
      })
    });

    if (res.status === 409) {
      writeLog?.("既に登録済みです (409)");
      return;
    }

    if (!res.ok) {
      throw new Error(`APIエラー (HTTP ${res.status})`);
    }

    const data = await res.json();

    writeLog?.("登録完了");

    if (data.fetched != null) writeLog?.(`fetched=${data.fetched}`);
    if (data.inserted != null) writeLog?.(`inserted=${data.inserted}`);
    if (data.skipped != null) writeLog?.(`skipped=${data.skipped}`);
    if (data.file_id) writeLog?.(`file_id=${data.file_id}`);
  }

  window.DataSourceKokkai = {
    run
  };

})();
