const navIcon = (name, size = 22) => {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z"/>',
    cases: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 2v4M16 2v4M3 9h18M8 13h3M8 17h7"/>',
    basics: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z"/>',
    review: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M18.4 9A7 7 0 0 0 6.2 6.2L4 9M5.6 15A7 7 0 0 0 17.8 17.8L20 15"/>',
    records: '<path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    arrowRight: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    play: '<path d="m9 7 8 5-8 5z"/>',
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    trend: '<path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    spark: '<path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    document: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
  };
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.spark}</svg>`;
};

function getPageCompletion(data, page) {
  const steps = page.steps || [];
  let required = 0;
  let completed = 0;
  for (const step of steps) {
    if (step.type === "proposalBuilder") {
      const values = state.answers[step.id]?.value || {};
      const requiredFields = (step.fields || []).filter((field) => field.required);
      required += requiredFields.length;
      completed += requiredFields.filter((field) => String(values[field.id] || "").trim()).length;
    } else {
      required += 1;
      if (state.answers[step.id]?.checked) completed += 1;
    }
  }
  return { required, completed, isComplete: required === 0 || completed >= required };
}

function getCaseCompletion(data) {
  const pages = data.pages.map((page) => getPageCompletion(data, page));
  const required = pages.reduce((total, page) => total + page.required, 0);
  const completed = pages.reduce((total, page) => total + page.completed, 0);
  return { required, completed, isComplete: required === 0 || completed >= required };
}

function render() {
  if (!catalog.length) return;
  const isCase = currentView.name === "case";
  document.body.classList.toggle("case-mode", isCase);
  app.innerHTML = `
    ${renderTopbar()}
    ${isCase ? renderCaseView(currentView.caseId, currentView.pageIndex) : renderMainView(currentView.name)}
    ${isCase ? "" : renderBottomNav(currentView.name)}
  `;
}

function renderBrandMark(label = "AQ") {
  return `<span class="brand-mark" aria-hidden="true"><span class="brand-bars"><i></i><i></i><i></i></span><b>${label}</b></span>`;
}

function renderTopbar() {
  if (currentView.name === "case") {
    const data = getCase(currentView.caseId);
    const pageCount = data.pages.length;
    const pageIndex = clamp(currentView.pageIndex, 0, pageCount - 1);
    const progress = Math.round(((pageIndex + 1) / pageCount) * 100);
    return `<header class="topbar case-topbar">
      <div class="topbar-inner">
        <button class="icon-button" data-action="close-case" aria-label="ケース一覧へ戻る">${navIcon("close", 21)}</button>
        <div class="case-progress-block">
          <div class="progress-label"><span class="case-top-title">${escapeHtml(data.title)}</span><span>${pageIndex + 1}/${pageCount}</span></div>
          <div class="progress-track" role="progressbar" aria-label="ケース進捗" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${progress}%"></div></div>
          <div class="page-dots" aria-hidden="true">${data.pages.map((_, index) => `<span class="page-dot ${index < pageIndex ? "done" : index === pageIndex ? "current" : ""}"></span>`).join("")}</div>
        </div>
        <span class="score-chip"><strong>${getCaseScore(data)}</strong><small>点</small></span>
      </div>
    </header>`;
  }

  return `<header class="topbar app-topbar">
    <div class="topbar-inner brand-row">
      <button class="brand-button" data-action="navigate" data-target="home" aria-label="ホームへ">${renderBrandMark()}<span class="brand-copy"><strong>Accounting Quest</strong><small>数字で経営を考える</small></span></button>
      <span class="header-status">${navIcon("spark", 17)}<strong>${getVisitedPageCount()}</strong><small>ページ</small></span>
    </div>
  </header>`;
}

