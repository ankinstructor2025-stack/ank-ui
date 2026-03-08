console.log("data_source_url.js loaded");

(function () {
  const CONFIG_PATH_MAP = {
    egov: "/config/egov.json",
    caa: "/config/caa.json"
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
      targetEl.innerHTML = `<div class="placeholder">子URLはありません</div>`;
      return;
    }

    const rows = pages
      .map((page, index) => {
        const no = index + 1;
        const pageUrl = escapeHtml(page.page_url ?? "");
        const status = escapeHtml(page.status ?? "");
        const createdAt = escapeHtml(page.created_at ?? "");

        return `
        <tr>
          <td>${no}</td>
          <td class="url-cell">${pageUrl}</td>
          <td>${status}</td>
          <td>${createdAt}</td>
        </tr>
      `;
      })
      .join("");

    targetEl.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th style="width:60px;">No</th>
            <th>子URL</th>
            <th style="width:120px;">status</th>
            <th style="width:220px;">created_at</th>
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
    targetEl.innerHTML = `<div class="placeholder">まだ取得していません</div>`;
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

  async function run({
    apiBase,
    url,
    sourceKey,
    targetUrl,
    method = "POST",
    idToken,
    writeLog,
    pagesContainer
  }) {
    if (!sourceKey) {
      throw new Error("sourceKey が指定されていません");
    }

    const config = await loadSourceConfig(sourceKey);

    const jsonTargetUrl = config?.request?.url ?? "";
    const actualTargetUrl = jsonTargetUrl || targetUrl;

    if (!actualTargetUrl) {
      throw new Error("targetUrl が指定されていません");
    }

    const requestUrl = buildRequestUrl(apiBase, url);

    writeLog?.(`公開URL取得開始: ${actualTargetUrl}`);
    writeLog?.(`source_key=${sourceKey}`);
    writeLog?.(`config_file=${getConfigPath(sourceKey)}`);

    const payload = {
      source_key: sourceKey,
      target_url: actualTargetUrl,
      config: config
    };

    const headers = {
      "Content-Type": "application/json"
    };

    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetch(requestUrl, {
      method,
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`公開URL取得失敗: ${text}`);
    }

    const data = await res.json();

    writeLog?.("公開URL取得完了");

    if (data.root_id) writeLog?.(`root_id=${data.root_id}`);
    if (data.source_key) writeLog?.(`source_key=${data.source_key}`);
    if (data.target_url) writeLog?.(`target_url=${data.target_url}`);
    if (data.requested_url) writeLog?.(`requested_url=${data.requested_url}`);
    if (data.page_count != null) writeLog?.(`page_count=${data.page_count}`);
    if (data.row_inserted != null) writeLog?.(`row_inserted=${data.row_inserted}`);
    if (data.row_skipped != null) writeLog?.(`row_skipped=${data.row_skipped}`);
    if (data.message) writeLog?.(data.message);

    if (Array.isArray(data.pages)) {
      writeLog?.(`pages=${data.pages.length}`);
      renderPages(data.pages, pagesContainer);
    } else {
      resetPages(pagesContainer);
    }

    return data;
  }

  window.DataSourceUrl = {
    run,
    renderPages,
    resetPages,
    loadSourceConfig
  };
})();
