document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("btn-import");
  const viewBtn = document.getElementById("btn-view");
  const knowledgeCreateBtn = document.getElementById("btn-knowledge-create");
  const knowledgeViewBtn = document.getElementById("btn-knowledge-view");
  const searchBtn = document.getElementById("btn-search");
  const logoutBtn = document.getElementById("btn-logout");

  const menuButtons = document.querySelectorAll(".menu-buttons .btn");
  const menuPanels = document.querySelectorAll(".menu-panel");

  function showPanel(panelId, activeButton) {
    menuPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelId);
    });

    menuButtons.forEach((button) => {
      button.classList.toggle("is-active", button === activeButton);
    });
  }

  function bindMenuButton(button, panelId, targetUrl) {
    if (!button) return;

    button.addEventListener("mouseenter", () => {
      showPanel(panelId, button);
    });

    button.addEventListener("focus", () => {
      showPanel(panelId, button);
    });

    button.addEventListener("click", () => {
      showPanel(panelId, button);
      window.location.href = targetUrl;
    });
  }

  bindMenuButton(importBtn, "panel-import", "data_source.html");
  bindMenuButton(viewBtn, "panel-view", "data_view.html");
  bindMenuButton(knowledgeCreateBtn, "panel-knowledge-create", "knowledge_create.html");
  bindMenuButton(knowledgeViewBtn, "panel-knowledge-view", "knowledge_view.html");
  bindMenuButton(searchBtn, "panel-search", "knowledge_search.html");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("idToken");
      localStorage.removeItem("idToken");
      window.location.href = "index.html";
    });
  }
});
