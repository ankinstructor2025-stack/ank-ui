console.log("data_source_url.js loaded");

(function () {

  const TEMPLATE_BASE_URL =
    "https://storage.googleapis.com/ank-bucket/template";

  const CONFIG_PATH_MAP = {
    url_egov: "egov.json",
    url_caa: "caa.json"
  };

  function getConfigFileName(sourceKey) {
    const fileName = CONFIG_PATH_MAP[sourceKey];
    if (!fileName) {
      throw new Error(`未対応の sourceKey です: ${sourceKey}`);
    }
    return fileName;
  }

  function getConfigUrl(sourceKey) {
    return `${TEMPLATE_BASE_URL}/${getConfigFileName(sourceKey)}`;
  }

  async function loadSourceConfig(sourceKey) {

    const configUrl = getConfigUrl(sourceKey);

    const res = await fetch(configUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`設定JSON取得失敗: ${configUrl} (HTTP ${res.status})`);
    }

    return await res.json();
  }

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderPages(pages, targetEl) {

    if (!targetEl) return;

    if (!Array.isArray(pages) || pages.length === 0) {
      targetEl.innerHTML = `<div>子URLなし</div>`;
      return;
    }

    const rows = pages.map((p, i) => {

      const url = escapeHtml(p.page_url ?? "");
      const status = escapeHtml(p.status ?? "");

      return `
      <tr>
        <td>${i + 1}</td>
        <td>${url}</td>
        <td>${status}</td>
      </tr>
      `;
    }).join("");

    targetEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>URL</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    `;
  }

  function resetPages(targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = "";
  }

  async function run({
    apiBase,
    sourceKey,
    idToken,
    writeLog,
    pagesContainer
  }) {

    if (!sourceKey) {
      throw new Error("sourceKey が指定されていません");
    }

    writeLog?.("公開URL取得開始");

    const config = await loadSourceConfig(sourceKey);

    writeLog?.(`config_url=${getConfigUrl(sourceKey)}`);

    const requestUrl = buildRequestUrl(apiBase, "/public_url/fetch_and_register");

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
        source_key: sourceKey,
        config
      })
    });

    if (!res.ok) {
      throw new Error(`APIエラー (HTTP ${res.status})`);
    }

    const data = await res.json();

    writeLog?.("公開URL取得完了");

    if (data.page_count != null) {
      writeLog?.(`page_count=${data.page_count}`);
    }

    if (Array.isArray(data.pages)) {
      renderPages(data.pages, pagesContainer);
    }

    return data;
  }

  window.DataSourceUrl = {
    run,
    renderPages,
    resetPages
  };

})();
