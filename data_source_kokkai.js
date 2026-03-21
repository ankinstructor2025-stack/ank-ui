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
      headers
    });

    if (res.status === 409) {
      writeLog?.("既に登録済みです (409)");
      return;
    }

    if (!res.ok) {
      let detail = `APIエラー (HTTP ${res.status})`;
      try {
        const data = await res.json();
        if (data?.detail) detail = data.detail;
      } catch (_) {}
      throw new Error(detail);
    }

    const data = await res.json();

    writeLog?.("登録完了");
    if (data.requested_url) writeLog?.(`requested_url=${data.requested_url}`);
    if (data.meeting_count != null) writeLog?.(`meeting_count=${data.meeting_count}`);
    if (data.document_count != null) writeLog?.(`document_count=${data.document_count}`);
    if (data.row_inserted != null) writeLog?.(`row_inserted=${data.row_inserted}`);
    if (data.row_skipped != null) writeLog?.(`row_skipped=${data.row_skipped}`);
  }

  window.DataSourceKokkai = {
    run
  };

})();
