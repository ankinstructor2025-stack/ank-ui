console.log("data_view_upload.js loaded");

window.DataViewUpload = (() => {
  async function load(ctx) {
    ctx.renderParentPlaceholder("アップロード照会は次段階です。");
    ctx.renderChildPlaceholder("親一覧から1件選択してください。");

    if (ctx.summaryText) ctx.summaryText.textContent = "0 件";
    if (ctx.selectionSummary) ctx.selectionSummary.textContent = "選択 0 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = "親一覧: アップロード";
    if (ctx.detailPre) ctx.detailPre.textContent = "アップロード照会は未実装です。";
    if (ctx.btnKnowledge) ctx.btnKnowledge.disabled = true;
  }

  return {
    load
  };
})();
