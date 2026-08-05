document.addEventListener("input", (event) => {
  if (!event.target?.dataset?.proposalField) return;
  queueMicrotask(() => {
    if (currentView.name !== "case") return;
    const data = getCase(currentView.caseId);
    const pageIndex = clamp(currentView.pageIndex, 0, data.pages.length - 1);
    const completion = getPageCompletion(data, data.pages[pageIndex]);
    const caseCompletion = getCaseCompletion(data);
    const nextButton = document.querySelector('.case-footer [data-action="change-page"], .case-footer [data-action="finish-case"]');
    const status = document.querySelector(".footer-page-status span");
    if (status) status.textContent = completion.isComplete ? "ページ完了" : `あと${completion.required - completion.completed}項目`;
    if (nextButton) {
      const isFinish = nextButton.dataset.action === "finish-case";
      nextButton.disabled = isFinish ? !caseCompletion.isComplete : !completion.isComplete;
    }
  });
});
