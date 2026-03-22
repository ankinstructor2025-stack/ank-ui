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
    return Number(isUsable) === 1 ? "採用" : "対象外";
  }

  function normalizeStatus(rawStatus) {
    const status = String(rawStatus ?? "").trim();

    if (!status) return "new";
    if (status === "done") return "done";
    if (status === "fetch_error") return "fetch_error";

    return status;
  }

  function toStatusLabel(rawStatus) {
    const status = normalizeStatus(rawStatus);

    switch (status) {
      case "done":
        return "分解済";
      case "fetch_error":
        return "取得失敗";
      default:
        return "未分解";
    }
  }

  function canDecompose(page) {
    if (!page) return false;
    if (Number(page.is_usable) !== 1) return false;
    if (page.page_type === "list") return false;
    if (page.page_type === "notice") return false;

    const status = normalizeStatus(page.status);
    if (status === "fetch_error") return false;
    if (status === "done") return false;

    return true;
  }

  function formatCreatedAt(value) {
    if (!value) return "";

    return String(value)
      .replace("T", " ")
      .replace("+00:00", "");
  }

  async function decomposePage({ apiBase, idToken, pageUrl }) {
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

  function clonePages(pages) {
    if (!Array.isArray(pages)) return [];
    return pages.map((p) => ({ ...p }));
  }

  function updatePageStatusLocally(pages, pageUrl, nextStatus) {
    return clonePages(pages).map((p) => {
      if ((p.page_url ?? "") === pageUrl) {
        return {
          ...p,
          status: nextStatus
        };
      }
      return { ...p };
    });
  }

  function renderPages(pages, targetEl, options = {}) {
    if (!targetEl) return;

    const {
      apiBase,
      idToken,
      writeLog
    } = options;

    const currentPages = clonePages(pages);

    if (!Array.isArray(currentPages) || currentPages.length === 0) {
      targetEl.innerHTML = `<div class="placeholder">子URLはありません</div>`;
      return;
    }

    const rows = currentPages.map((p, i) => {
      const urlRaw = p.page_url ?? "";
      const depth = p.depth ?? "";
      const pageType = toPageTypeLabel(p.page_type);
      const score = p.score ?? 0;
      const usable = toUsableLabel(p.is_usable);
      const rawStatus = normalizeStatus(p.status);
      const displayStatus = toStatusLabel(rawStatus);
      const createdAt = formatCreatedAt(p.created_at ?? "").split(" ")[0];

      const statusClass =
        rawStatus === "done"
          ? "status-done"
          : rawStatus === "fetch_error"
            ? "status-error"
            : "status-new";

      const actionHtml =
        rawStatus === "done"
          ? `<span class="url-chip status-done">分解済</span>`
          : canDecompose(p)
            ? `
              <button
                type="button"
                class="btn btn-primary btn-decompose"
                data-page-url="${escapeHtml(urlRaw)}">
                分解
              </button>
            `
            : `<span class="url-chip">対象外</span>`;

      return `
        <div class="url-page-card">
          <div class="url-page-head">
            <div class="url-page-title">
              ${i + 1}. 
              <a href="${escapeHtml(urlRaw)}" target="_blank" rel="noopener noreferrer">
                ${escapeHtml(urlRaw)}
              </a>
            </div>
          </div>

          <div class="url-page-meta">
            <span class="url-chip">階層 ${escapeHtml(depth)}</span>
            <span class="url-chip">${escapeHtml(pageType)}</span>
            <span class="url-chip">評価 ${escapeHtml(score)}</span>
            <span class="url-chip">${escapeHtml(usable)}</span>
            <span class="url-chip ${statusClass}">${escapeHtml(displayStatus)}</span>
            <span class="url-chip">${escapeHtml(createdAt)}</span>
          </div>

          <div class="url-page-actions">
            ${actionHtml}
          </div>
        </div>
      `;
    }).join("");

    targetEl.innerHTML = `
      <div class="url-page-list">
        ${rows}
      </div>
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
            pageUrl
          });

          writeLog?.(`分解完了: ${pageUrl}`);

          if (data.row_count != null) writeLog?.(`row_count=${data.row_count}`);
          if (data.qa_count != null) writeLog?.(`qa_count=${data.qa_count}`);
          if (data.text_count != null) writeLog?.(`text_count=${data.text_count}`);

          if (Array.isArray(data.pages)) {
            renderPages(data.pages, targetEl, {
              apiBase,
              idToken,
              writeLog
            });
            return;
          }

          const updatedPages = updatePageStatusLocally(currentPages, pageUrl, "done");

          renderPages(updatedPages, targetEl, {
            apiBase,
            idToken,
            writeLog
          });
        } catch (e) {
          console.error(e);
          writeLog?.(`分解失敗: ${pageUrl} / ${e.message}`);

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
