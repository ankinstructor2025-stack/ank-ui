document.addEventListener("DOMContentLoaded", () => {

  const importBtn = document.getElementById("btn-import");
  const viewBtn = document.getElementById("btn-view");

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

});
