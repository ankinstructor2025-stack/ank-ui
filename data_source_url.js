console.log("data_source_url.js loaded");

(function () {

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

  async function run({ apiBase, url, targetUrl, method = "POST", idToken, writeLog }) {
    if (!targetUrl) {
      throw new Error("targetUrl が指定されていません");
    }

    const requestUrl = buildRequestUrl(apiBase, url);

    writeLog(`公開URL取得開始: ${targetUrl}`);

    const res = await fetch(requestUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        target_url: targetUrl
      })
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`公開URL取得失敗: ${text}`);
    }

    const data = await res.json();

    writeLog("公開URL取得完了");

    if (data.source_id) writeLog(`source_id=${data.source_id}`);
    if (data.source_type) writeLog(`source_type=${data.source_type}`);
    if (data.target_url) writeLog(`target_url=${data.target_url}`);
    if (data.page_count != null) writeLog(`page_count=${data.page_count}`);
    if (data.row_inserted != null) writeLog(`row_inserted=${data.row_inserted}`);
    if (data.row_skipped != null) writeLog(`row_skipped=${data.row_skipped}`);
    if (data.message) writeLog(data.message);

    return data;
  }

  window.DataSourceUrl = {
    run
  };
})();
