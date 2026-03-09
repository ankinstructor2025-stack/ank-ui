console.log("data_source_url.js loaded");

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

    const rows = pages.map((p, i) => {
      const url = escapeHtml(p.page_url ?? "");
      const status = escapeHtml(p.status ?? "");
      const createdAt = escapeHtml(p.created_at ?? "");

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${url}</td>
          <td>${status}</td>
          <td>${createdAt}</td>
        </tr>
      `;
    }).join("");

    targetEl.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th style="width:60px;">No</th>
            <th>URL</th>
            <th style="width:120px;">Status</th>
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

    const requestUrl = buildRequestUrl(apiBase, "/public_url/register");

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
    } else {
      resetPages(pagesContainer);
    }

    return data;
  }

  window.DataSourceUrl = {
    run,
    renderPages,
    resetPages
  };

})();
