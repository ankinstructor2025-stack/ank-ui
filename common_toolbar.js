/**
 * common_toolbar.js
 *
 * 役割
 * - 共通ツールバー描画
 * - source_master.json を読んで sourceSelect を自動設定
 * - メニュー / ログアウトの共通動作
 * - sourceSelect 変更時にカスタムイベントを発火
 *
 * 発火イベント:
 * - toolbar:ready
 * - toolbar:source-change
 */

(function () {
  "use strict";

  const DEFAULT_SOURCE_JSON_PATH = "./source_master.json";
  const DEFAULT_MENU_URL = "./menu.html";
  const DEFAULT_LOGOUT_URL = "./index.html";

  let toolbarState = {
    mountId: "",
    title: "",
    showSourceSelect: false,
    showDbSelect: false,
    sourceJsonPath: DEFAULT_SOURCE_JSON_PATH,
    menuUrl: DEFAULT_MENU_URL,
    logoutUrl: DEFAULT_LOGOUT_URL,
    actions: [],
    sourceList: [],
    sourceMap: {}
  };

  async function renderPageToolbar(options) {
    const opts = normalizeOptions(options);
    toolbarState = {
      ...toolbarState,
      ...opts
    };

    const mount = document.getElementById(opts.mountId);
    if (!mount) {
      console.error("renderPageToolbar: mount not found:", opts.mountId);
      return;
    }

    mount.innerHTML = buildToolbarHtml(opts);

    bindCommonActions(opts);

    if (opts.showSourceSelect) {
      try {
        const sourceList = await loadSourceMaster(opts.sourceJsonPath);
        toolbarState.sourceList = sourceList;
        toolbarState.sourceMap = buildSourceMap(sourceList);

        fillSourceSelect(sourceList, {
          selectId: "sourceSelect",
          placeholder: opts.sourcePlaceholder
        });

        dispatchToolbarReady();
      } catch (err) {
        console.error("source master load failed:", err);
        fillSourceSelectError("sourceSelect", "取得失敗");
        dispatchToolbarReady(err);
      }
    } else {
      dispatchToolbarReady();
    }
  }

  function normalizeOptions(options) {
    const src = options || {};
    return {
      mountId: src.mountId || "",
      title: src.title || "",
      showSourceSelect: Boolean(src.showSourceSelect),
      showDbSelect: Boolean(src.showDbSelect),
      sourceJsonPath: src.sourceJsonPath || DEFAULT_SOURCE_JSON_PATH,
      sourcePlaceholder: src.sourcePlaceholder || "選択してください",
      menuUrl: src.menuUrl || DEFAULT_MENU_URL,
      logoutUrl: src.logoutUrl || DEFAULT_LOGOUT_URL,
      actions: Array.isArray(src.actions) ? src.actions : []
    };
  }

  function buildToolbarHtml(opts) {
    const mainClasses = ["page-toolbar-main"];
    if (opts.showSourceSelect) mainClasses.push("has-source");
    if (opts.showDbSelect) mainClasses.push("has-db");

    return `
      <div class="page-toolbar">
        <div class="page-toolbar-title">
          ${escapeHtml(opts.title)}
        </div>

        <div class="${mainClasses.join(" ")}">
          ${opts.showSourceSelect ? `
            <div class="toolbar-field">
              <label for="sourceSelect">データ種別</label>
              <select id="sourceSelect" class="toolbar-select"></select>
            </div>
          ` : ""}

          ${opts.showDbSelect ? `
            <div class="toolbar-field">
              <label for="dbSelect">ナレッジDB</label>
              <select id="dbSelect" class="toolbar-select" disabled>
                <option value="">選択してください</option>
              </select>
            </div>
          ` : ""}
        </div>

        <div class="page-toolbar-actions">
          ${opts.actions.map((action) => `
            <button
              id="${escapeHtml(action.id)}"
              class="btn"
              type="button"
            >
              ${escapeHtml(action.label)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function bindCommonActions(opts) {
    const btnMenu = document.getElementById("btnMenu");
    const btnLogout = document.getElementById("btnLogout");
    const sourceSelect = document.getElementById("sourceSelect");

    if (btnMenu) {
      btnMenu.addEventListener("click", () => {
        window.location.href = opts.menuUrl;
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        try {
          sessionStorage.removeItem("idToken");
          localStorage.removeItem("idToken");

          if (
            window.firebase &&
            typeof window.firebase.auth === "function" &&
            window.firebase.auth().currentUser
          ) {
            try {
              await window.firebase.auth().signOut();
            } catch (signOutErr) {
              console.warn("firebase signOut failed:", signOutErr);
            }
          }
        } finally {
          window.location.href = opts.logoutUrl;
        }
      });
    }

    if (sourceSelect) {
      sourceSelect.addEventListener("change", () => {
        const selectedKey = sourceSelect.value || "";
        const source = toolbarState.sourceMap[selectedKey] || null;

        dispatchSourceChange({
          sourceKey: selectedKey,
          sourceLabel: source?.label || "",
          sourceGroup: source?.group || "",
          sourceType: source?.type || ""
        });
      });
    }
  }

  async function loadSourceMaster(jsonPath) {
    const res = await fetch(jsonPath, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`source_master.json load failed: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("source_master.json format error");
    }

    return data
      .filter((row) => row && row.key && row.label)
      .map((row) => ({
        key: String(row.key),
        label: String(row.label),
        group: String(row.group || ""),
        type: String(row.type || "")
      }));
  }

  function buildSourceMap(sourceList) {
    const map = {};
    sourceList.forEach((row) => {
      map[row.key] = row;
    });
    return map;
  }

  function fillSourceSelect(sourceList, options) {
    const select = document.getElementById(options.selectId);
    if (!select) return;

    const placeholder = options.placeholder || "選択してください";
    const grouped = groupBy(sourceList, "group");

    let html = `<option value="">${escapeHtml(placeholder)}</option>`;

    Object.keys(grouped).forEach((groupName) => {
      const rows = grouped[groupName];
      if (groupName) {
        html += `<optgroup label="${escapeHtml(groupName)}">`;
      }

      rows.forEach((row) => {
        html += `
          <option
            value="${escapeHtml(row.key)}"
            data-source-type="${escapeHtml(row.type)}"
            data-source-group="${escapeHtml(row.group)}"
          >
            ${escapeHtml(row.label)}
          </option>
        `;
      });

      if (groupName) {
        html += `</optgroup>`;
      }
    });

    select.innerHTML = html;
  }

  function fillSourceSelectError(selectId, message) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = `<option value="">${escapeHtml(message || "取得失敗")}</option>`;
    select.disabled = true;
  }

  function groupBy(list, keyName) {
    const result = {};
    list.forEach((row) => {
      const key = row[keyName] || "";
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(row);
    });
    return result;
  }

  function dispatchToolbarReady(error) {
    document.dispatchEvent(
      new CustomEvent("toolbar:ready", {
        detail: {
          sourceList: toolbarState.sourceList,
          sourceMap: toolbarState.sourceMap,
          error: error || null
        }
      })
    );
  }

  function dispatchSourceChange(detail) {
    document.dispatchEvent(
      new CustomEvent("toolbar:source-change", {
        detail
      })
    );
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToolbarSourceList() {
    return toolbarState.sourceList.slice();
  }

  function getToolbarSourceMap() {
    return { ...toolbarState.sourceMap };
  }

  function getSelectedSource() {
    const select = document.getElementById("sourceSelect");
    if (!select) return null;

    const key = select.value || "";
    return toolbarState.sourceMap[key] || null;
  }

  window.renderPageToolbar = renderPageToolbar;
  window.getToolbarSourceList = getToolbarSourceList;
  window.getToolbarSourceMap = getToolbarSourceMap;
  window.getSelectedSource = getSelectedSource;
})();
