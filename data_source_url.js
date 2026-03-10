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

  function toPageTypeLabel(pageType) {
    switch (pageType) {
      case "faq":
        return "QA";
      case "guide":
        return "説明";
      case "notice":
        return "お知らせ";
      case "list":
        return "一覧";
      default:
        return "不明";
    }
  }

  function toUsableLabel(isUsable) {
    return Number(isUsable) === 1 ? "○" : "×";
  }

  async function decomposePage({ apiBase, idToken, pageUrl, writeLog }) {
    const requestUrl = buildRequestUrl(apiBase, "/public-url/decompose");

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
        page_url: pageUrl
      })
    });

    if (!res.ok) {
      throw new Error(`分解APIエラー (HTTP ${res.status})`);
    }

    return await res.json();
  }

  function renderPages(pages, targetEl, options = {}) {
    if (!targetEl) return;

    const {
      apiBase,
      idToken,
      writeLog
    } = options;

    if (!Array.isArray(pages) || pages.length === 0) {
      targetEl.innerHTML = `<div class="placeholder">子URLはありません</div>`;
      return;
    }

    const rows = pages.map((p, i) => {
      const urlRaw = p.page_url ?? "";
      const url = escapeHtml(urlRaw);
      const depth = escapeHtml(p.depth ?? "");
      const pageType = escapeHtml(toPageTypeLabel(p.page_type));
      const score = escapeHtml(p.score ?? 0);
      const usable = escapeHtml(toUsableLabel(p.is_usable));
      const judgeReason = escapeHtml(p.judge_reason ?? "");
      const status = escapeHtml(p.status ?? "");
      const createdAt = escapeHtml(p.created_at ?? "");

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${depth}</td>
          <td>
            <a href="${url}" target="_blank" rel="noopener noreferrer">
              ${url}
            </a>
          </td>
          <td>${pageType}</td>
          <td>${score}</td>
          <td>${usable}</td>
          <td>${judgeReason}</td>
          <td>${status}</td>
          <td>${createdAt}</td>
          <td>
            <button
              type="button"
              class="btn btn-primary btn-decompose"
              data-page-url="${url}">
              分解
            </button>
          </td>
        </tr>
      `;
    }).join("");

    targetEl.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th style="width:60px;">No</th>
            <th style="width:70px;">階層</th>
            <th>URL</th>
            <th style="width:90px;">種別</th>
            <th style="width:90px;">評価点</th>
            <th style="width:70px;">採用</th>
            <th style="width:180px;">判定理由</th>
            <th style="width:120px;">Status</th>
            <th style="width:220px;">created_at</th>
            <th style="width:100px;">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    targetEl.querySelectorAll(".btn-decompose").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pageUrl = btn.dataset.pageUrl;
        if (!pageUrl) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "分解中";

        try {
          writeLog?.(`分解開始: ${pageUrl}`);

          const data = await decomposePage({
            apiBase,
            idToken,
            pageUrl,
            writeLog
          });

          writeLog?.(`分解完了: ${pageUrl}`);

          if (data.row_count != null) writeLog?.(`row_count=${data.row_count}`);
          if (data.qa_count != null) writeLog?.(`qa_count=${data.qa_count}`);
          if (data.text_count != null) writeLog?.(`text_count=${data.text_count}`);
        } catch (e) {
          console.error(e);
          writeLog?.(`分解失敗: ${pageUrl} / ${e.message}`);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
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

    const requestUrl = buildRequestUrl(apiBase, "/public-url/register");

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
      renderPages(data.pages, pagesContainer, {
        apiBase,
        idToken,
        writeLog
      });
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
