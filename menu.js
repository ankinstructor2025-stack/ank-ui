document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("btn-import");
  const viewBtn = document.getElementById("btn-view");
  const knowledgeCreateBtn = document.getElementById("btn-knowledge-create");
  const knowledgeViewBtn = document.getElementById("btn-knowledge-view");
  const searchBtn = document.getElementById("btn-search");
  const logoutBtn = document.getElementById("btn-logout");

  if (importBtn) {
    importBtn.addEventListener("click", () => {
      window.location.href = "data_source.html";
    });
  }

  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      window.location.href = "data_view.html";
    });
  }

  if (knowledgeCreateBtn) {
    knowledgeCreateBtn.addEventListener("click", () => {
      window.location.href = "knowledge_create.html";
    });
  }

  if (knowledgeViewBtn) {
    knowledgeViewBtn.addEventListener("click", () => {
      window.location.href = "knowledge_view.html";
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      window.location.href = "knowledge_search.html";
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("idToken");
      localStorage.removeItem("idToken");
      window.location.href = "index.html";
    });
  }
});
