console.log("data_source_url.js loaded");

(function () {

  const PAGE_SIZE = 5;
  let publicUrlDisplayTimer = null;
  let lastDisplayValue = null;

  function buildRequestUrl(apiBase, path) {
    if (!path) throw new Error("path が指定されていません");

    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/")) return `${apiBase}${path}`;

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

  function toUsableLabel(isUsable) {
    return Number(isUsable) === 1 ? "採用" : "対象外";
  }

  function toDecisionLabel(decision) {
    switch (decision) {
      case "pass": return "採用";
      case "review": return "確認";
      case "reject": return "除外";
      default: return "不明";
    }
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
      case "done": return "分解済";
      case "fetch_error": return "取得失敗";
      default: return "未分解";
    }
  }

  function canDecompose(page) {
    if (!page) return false;

    const decision = String(page.decision ?? "").trim();
    if (decision !== "pass") return false;

    const status = normalizeStatus(page.status);
    if (status === "fetch_error") return false;
    if (status === "done") return false;

    return true;
  }

  function formatCreatedAt(value) {
    if (!value) return "";
    return String(value).replace("T", " ").replace("+00:00", "");
  }

  function formatPublicUrlDisplay(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length >= 2) {
      return `${lines[0]}：${lines.slice(1).join(" ")}`;
    }

    return lines[0];
  }

  function syncPublicUrlDisplay(config) {
    const displayEl = document.getElementById("publicUrlTargetDisplay");
    if (!displayEl || !config) return;

    const nextValue = `${config.label}：${config.url}`;
    if (nextValue === lastDisplayValue) return;

    lastDisplayValue = nextValue;
    displayEl.textContent = nextValue;
  }

  function startPublicUrlDisplaySync() {
    if (publicUrlDisplayTimer) return;

    syncPublicUrlDisplay();

    publicUrlDisplayTimer = window.setInterval(() => {
      syncPublicUrlDisplay();
    }, 300);
  }

  async function decomposePage({ apiBase, idToken, pageUrl }) {
    const requestUrl = buildRequestUrl(apiBase, "/public-url/decompose");

    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const res = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ page_url: pageUrl })
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

  function sortPages(pages) {
    return clonePages(pages).sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  function updatePageStatusLocally(pages, pageUrl, nextStatus) {
    return clonePages(pages).map((p) => {
      if ((p.page_url ?? "") === pageUrl) {
        return { ...p, status: nextStatus };
      }
      return { ...p };
    });
  }

  function ensurePagerState(targetEl, pages) {
    if (!targetEl) {
      return {
        currentPage: 1,
        pageSize: PAGE_SIZE,
        allPages: []
      };
    }

    if (!targetEl.__pagerState) {
      targetEl.__pagerState = {
        currentPage: 1,
        pageSize: PAGE_SIZE,
        allPages: []
      };
    }

    if (Array.isArray(pages)) {
      targetEl.__pagerState.allPages = sortPages(pages);
    }

    if (!targetEl.__pagerState.pageSize || targetEl.__pagerState.pageSize < 1) {
      targetEl.__pagerState.pageSize = PAGE_SIZE;
    }

    const totalPages = Math.max(
      1,
      Math.ceil((targetEl.__pagerState.allPages.length || 0) / targetEl.__pagerState.pageSize)
    );

    if (!targetEl.__pagerState.currentPage || targetEl.__pagerState.currentPage < 1) {
      targetEl.__pagerState.currentPage = 1;
    }

    if (targetEl.__pagerState.currentPage > totalPages) {
      targetEl.__pagerState.currentPage = totalPages;
    }

    return targetEl.__pagerState;
  }

  function buildPageRows({ pages, pageOffset }) {
    return pages.map((p, i) => {
      const rowNo = pageOffset + i + 1;
      const urlRaw = p.page_url ?? "";
      const depth = p.depth ?? "";
      const score = p.score ?? 0;
      const usable = toUsableLabel(p.is_usable);
      const decision = toDecisionLabel(p.decision);
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
        <div class="url-page-card" data-page-url="${escapeHtml(urlRaw)}">
          <div class="url-page-title">
            ${rowNo}. 
            <a href="${escapeHtml(urlRaw)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(urlRaw)}
            </a>
          </div>

          <div class="url-page-meta">
            <span class="url-chip">階層 ${escapeHtml(depth)}</span>
            <span class="url-chip">評価 ${escapeHtml(score)}</span>
            <span class="url-chip">${escapeHtml(decision)}</span>
            <span class="url-chip">${escapeHtml(usable)}</span>
            <span class="url-chip ${statusClass}">${escapeHtml(displayStatus)}</span>
            <span class="url-chip">${escapeHtml(createdAt)}</span>
            ${actionHtml}
          </div>
        </div>
      `;
    }).join("");
  }

  function buildPagerHtml(currentPage, totalPages, totalCount) {
    const prevDisabled = currentPage <= 1 ? "disabled" : "";
    const nextDisabled = currentPage >= totalPages ? "disabled" : "";

    return `
      <div class="url-pager">
        <div class="url-pager-info">
          ${escapeHtml(totalCount)}件 / ${escapeHtml(currentPage)} / ${escapeHtml(totalPages)}ページ
        </div>
        <div class="url-pager-actions">
          <button type="button" class="btn btn-primary btn-page-prev" ${prevDisabled}>前へ</button>
          <button type="button" class="btn btn-primary btn-page-next" ${nextDisabled}>次へ</button>
        </div>
      </div>
    `;
  }

  function renderPages(pages, targetEl, options = {}) {
    if (!targetEl) return;

    const { apiBase, idToken, writeLog } = options;
    const state = ensurePagerState(targetEl, pages);
    const allPages = Array.isArray(state.allPages) ? state.allPages : [];

    if (allPages.length === 0) {
      targetEl.innerHTML = `<div class="placeholder">子URLはありません</div>`;
      return;
    }

    const totalCount = allPages.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize));
    const currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);
    const startIndex = (currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    const visiblePages = allPages.slice(startIndex, endIndex);

    const rowsHtml = buildPageRows({
      pages: visiblePages,
      pageOffset: startIndex
    });

    const pagerHtml = buildPagerHtml(currentPage, totalPages, totalCount);

    targetEl.innerHTML = `
      <div class="url-page-list">${rowsHtml}</div>
      ${pagerHtml}
    `;

    const prevBtn = targetEl.querySelector(".btn-page-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (state.currentPage <= 1) return;
        state.currentPage -= 1;
        renderPages(null, targetEl, options);
      });
    }

    const nextBtn = targetEl.querySelector(".btn-page-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (state.currentPage >= totalPages) return;
        state.currentPage += 1;
        renderPages(null, targetEl, options);
      });
    }

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

          if (data.content_length != null) {
            writeLog?.(`content_length=${data.content_length}`);
          }

          state.allPages = updatePageStatusLocally(state.allPages, pageUrl, "done");

          renderPages(null, targetEl, {
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

    targetEl.__pagerState = {
      currentPage: 1,
      pageSize: PAGE_SIZE,
      allPages: []
    };

    targetEl.innerHTML = `<div class="placeholder">まだ取得していません</div>`;
  }

  async function run({
    apiBase,
    sourceKey,
    idToken,
    writeLog,
    pagesContainer
  }) {
    if (!sourceKey) throw new Error("sourceKey が指定されていません");

    syncPublicUrlDisplay();
    writeLog?.("公開URL取得開始");

    const requestUrl = buildRequestUrl(apiBase, "/public-url/register");

    const headers = { "Content-Type": "application/json" };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    const res = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ source_key: sourceKey })
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
      pagesContainer.__pagerState = {
        currentPage: 1,
        pageSize: PAGE_SIZE,
        allPages: sortPages(data.pages)
      };

      renderPages(null, pagesContainer, {
        apiBase,
        idToken,
        writeLog
      });
    } else {
      resetPages(pagesContainer);
    }

    return data;
  }

  document.addEventListener("DOMContentLoaded", () => {
    startPublicUrlDisplaySync();
  });

  window.DataSourceUrl = {
    run,
    renderPages,
    resetPages,
    syncPublicUrlDisplay
  };

})();
