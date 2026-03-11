console.log("data_view_public_url.js loaded");

window.DataViewPublicUrl = (() => {
  async function load(ctx) {
    const source = ctx.sourceMap[ctx.currentSourceKey];

    ctx.renderParentPlaceholder("公開URL照会は次段階です。");
    ctx.renderChildPlaceholder("親一覧から1件選択してください。");

    if (ctx.summaryText) ctx.summaryText.textContent = "0 件";
    if (ctx.selectionSummary) ctx.selectionSummary.textContent = "選択 0 件";
    if (ctx.contextSummary) ctx.contextSummary.textContent = `親一覧: ${source?.label || "公開URL"}`;
    if (ctx.detailPre) ctx.detailPre.textContent = "公開URL照会は未実装です。";
    if (ctx.btnKnowledge) ctx.btnKnowledge.disabled = true;
  }

  return {
    load
  };
})();
