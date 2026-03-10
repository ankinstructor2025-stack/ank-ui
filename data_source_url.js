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

  function canDecompose(page) {
    if (!page) return false;
    if (Number(page.is_usable) !== 1) return false;
    if (page.page_type === "list") return false;
    if (page.page_type === "notice") return false;
    if (page.status === "fetch_error") return false;
    return true;
  }

  function formatCreatedAt(value) {
    if (!value) return "";
    return String(value).replace("T", " ").replace("+00:00", "");
  }

  function buildTreeUrlHtml(pageUrl, depth) {
    const safeUrl = escapeHtml(pageUrl ?? "");
    const d = Number(depth || 0);
    const indentPx = Math.max(0, (d - 1) * 18);
    const marker = d > 1 ? "└ " : "";

    return `
      <div style="padding-left:${indentPx}px; line-height:1.5; word-break:break-all;">
        <span>${escapeHtml(marker)}</span>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          ${safeUrl}
        </a>
      </div>
    `;
  }

  function buildMetaCell(label, value) {
    return `
      <span style="display:inline-block; margin-right:14px; white-space:nowrap;">
        <span style="color:#666;">${escapeHtml(label)}:</span>
        <span>${escapeHtml(value)}</span>
      </span>
    `;
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
      const depth = p.depth ?? "";
      const pageType = toPageTypeLabel(p.page_type);
      const score = p.score ?? 0;
      const usable = toUsableLabel(p.is_usable);
      const status = p.status ?? "";
      const createdAt = formatCreatedAt(p.created_at ?? "").split(" ")[0];

      const actionHtml = canDecompose(p)
        ? `
          <button
            type="button"
            class="btn btn-primary btn-decompose"
            data-page-url="${escapeHtml(urlRaw)}">
            分解
          </button>
        `
        : `<span style="color:#666;">対象外</span>`;

      return `
        <tr>
          <td style="padding:8px 6px; border-bottom:1px solid #eee;">

            <div style="font-size:14px;">
              <b>No:</b> ${i + 1}
              &nbsp;&nbsp;
              <b>階層:</b> ${escapeHtml(depth)}
            </div>

            <div style="margin-top:4px;">
              <b>URL:</b>
            </div>

            ${buildTreeUrlHtml(urlRaw, depth)}

            <div style="margin-top:6px; font-size:13px; line-height:1.6;">
              ${buildMetaCell("種別", pageType)}
              ${buildMetaCell("評価点", score)}
              ${buildMetaCell("採用", usable)}
              ${buildMetaCell("Status", status)}
              ${buildMetaCell("作成日", createdAt)}
              <span style="margin-left:10px;">
                <span style="color:#666;">操作:</span>
                ${actionHtml}
              </span>
            </div>

          </td>
        </tr>
      `;

    }).join("");

    targetEl.innerHTML = `
      <table class="simple-table">
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

    if (data.row_inserted != null) {
      writeLog?.(`row_inserted=${data.row_inserted}`);
    }

    if (data.row_skipped != null) {
      writeLog?.(`row_skipped=${data.row_skipped}`);
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
