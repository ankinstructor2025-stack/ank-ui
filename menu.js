document.addEventListener("DOMContentLoaded", () => {

  const importBtn = document.getElementById("btn-import");

  if (importBtn) {
    importBtn.addEventListener("click", () => {

      window.location.href = "data_source.html";

    });
  }

});
