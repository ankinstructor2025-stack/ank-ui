/**
 * 共通ツールバー描画
 * 必須:
 *  - mountId
 *  - title
 */
function renderPageToolbar(options) {
  const {
    mountId,
    title = "",
    showSourceSelect = false,
    showDbSelect = false,
    actions = []
  } = options || {};

  const mount = document.getElementById(mountId);
  if (!mount) {
    console.error("renderPageToolbar: mount not found:", mountId);
    return;
  }

  // =========================
  // HTML生成
  // =========================
  const html = `
    <div class="page-toolbar">
      
      <div class="page-toolbar-title">
        ${escapeHtml(title)}
      </div>

      <div class="page-toolbar-main ${showDbSelect ? "has-db" : ""}">
        
        ${showSourceSelect ? `
        <div class="toolbar-field">
          <label>データ種別</label>
          <select id="sourceSelect" class="toolbar-select"></select>
        </div>
        ` : ""}

        ${showDbSelect ? `
        <div class="toolbar-field">
          <label>ナレッジDB</label>
          <select id="dbSelect" class="toolbar-select"></select>
        </div>
        ` : ""}

      </div>

      <div class="page-toolbar-actions">
        ${actions.map(a => `
          <button id="${escapeHtml(a.id)}" class="btn" type="button">
            ${escapeHtml(a.label)}
          </button>
        `).join("")}
      </div>

    </div>
  `;

  mount.innerHTML = html;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
