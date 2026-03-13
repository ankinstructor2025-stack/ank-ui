document.addEventListener("DOMContentLoaded", () => {

  const importBtn = document.getElementById("btn-import");
  const viewBtn = document.getElementById("btn-view");
  const knowledgeBtn = document.getElementById("btn-knowledge");
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

  if (knowledgeBtn) {
    knowledgeBtn.addEventListener("click", () => {
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
      window.location.href = "index.html";
    });
  }

});
