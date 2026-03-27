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

  const mainClasses = ["page-toolbar-main"];
  if (showSourceSelect) mainClasses.push("has-source");
  if (showDbSelect) mainClasses.push("has-db");

  const html = `
    <div class="page-toolbar">
      <div class="page-toolbar-title">
        ${escapeHtml(title)}
      </div>

      <div class="${mainClasses.join(" ")}">
        ${showSourceSelect ? `
        <div class="toolbar-field">
          <label for="sourceSelect">データ種別</label>
          <select id="sourceSelect" class="toolbar-select"></select>
        </div>
        ` : ""}

        ${showDbSelect ? `
        <div class="toolbar-field">
          <label for="dbSelect">ナレッジDB</label>
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

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
