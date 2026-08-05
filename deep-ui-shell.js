function deepIcon(name, size = 22) {
  const paths = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
    flame: '<path d="M12 22c4.4 0 7-2.7 7-6.7 0-3.2-1.8-5.6-4.6-8.6.2 2.1-.8 3.5-2 4.3.1-3.6-2.2-6.7-5.1-9 .3 3.7-2.3 5.8-2.3 9.7C5 17.7 7.7 22 12 22Z"/><path d="M9.5 18.8c-1.1-2 .1-3.4 1.4-4.8.1 1.1.5 1.8 1.1 2.2.6-.6 1-1.4.9-2.6 1.4 1.5 2.1 2.8 1.3 4.5-.7 1.5-3.7 2.1-4.7.7Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    hint: '<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5C7.5 13.6 7 12.3 7 11a5 5 0 0 1 10 0c0 1.3-.5 2.6-1.5 3.5-.8.8-1.3 1.4-1.5 2.5h-4c-.2-1.1-.7-1.7-1.5-2.5Z"/>',
    retry: '<path d="M4 4v6h6M20 20v-6h-6"/><path d="M5.5 15a7 7 0 0 0 11.7 2.3L20 14M4 10l2.8-3.3A7 7 0 0 1 18.5 9"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    offline: '<path d="m2 2 20 20M8.5 8.5A6 6 0 0 1 18 10M5 10a10 10 0 0 1 1-1.7M2 14a14 14 0 0 1 2.7-2.5M8.5 17.5A5 5 0 0 1 12 16c1.1 0 2.1.3 3 .9M12 21h.01"/>',
  };
  return `<svg class="deep-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.target}</svg>`;
}

render = function renderDeepApp() {
  if (!catalog.length) return;
  ensureDeepState();
  const isCase = currentView.name === "case";
  document.body.classList.toggle("case-mode", isCase);
  document.body.classList.toggle("reduce-motion", Boolean(state.settings.reducedMotion));
  app.innerHTML = `
    ${renderTopbar()}
    ${isCase ? renderCaseView(currentView.caseId, currentView.pageIndex) : renderMainView(currentView.name)}
    ${isCase ? "" : renderBottomNav(currentView.name)}
    <div id="deep-announcer" class="sr-only" aria-live="polite"></div>
    ${renderDeepLayers()}
  `;
  queueMicrotask(() => {
    document.querySelector(".page-title")?.setAttribute("tabindex", "-1");
  });
};

renderTopbar = function renderDeepTopbar() {
  if (currentView.name === "case") {
    const data = getCase(currentView.caseId);
    const pageIndex = clamp(currentView.pageIndex, 0, data.pages.length - 1);
    const completePages = data.pages.filter((page) => getPageCompletion(data, page).isComplete).length;
    const progress = Math.round((completePages / data.pages.length) * 100);
    return `<header class="topbar case-topbar deep-case-topbar">
      <div class="topbar-inner">
        <button class="icon-button" data-action="request-close-case" aria-label="ケースを閉じる">${deepIcon("close", 20)}</button>
        <button class="case-progress-button" data-action="open-page-map" aria-label="ページ一覧を開く">
          <span class="case-progress-copy"><strong>${escapeHtml(data.title)}</strong><small>${completePages}/${data.pages.length}ページ完了</small></span>
          <span class="deep-progress-track" role="progressbar" aria-label="完了したページ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></span>
        </button>
        <div class="topbar-utility"><span class="save-status" title="学習データはこの端末に保存されます">${deepIcon("save", 15)}<span>${getSaveStatusLabel()}</span></span><span class="score-chip"><strong>${getCaseScore(data)}</strong><small>点</small></span></div>
      </div>
    </header>`;
  }
  const streak = getLearningStreak();
  return `<header class="topbar app-topbar deep-app-topbar"><div class="topbar-inner brand-row">
    <button class="brand-button" data-action="navigate" data-target="home" aria-label="ホームへ">${renderBrandMark()}<span class="brand-copy"><strong>Accounting Quest</strong><small>数字で経営を考える</small></span></button>
    <div class="deep-header-actions"><span class="streak-chip ${streak.activeToday ? "active" : ""}">${deepIcon("flame", 17)}<strong>${streak.current}</strong><small>日</small></span><button class="deep-icon-button" data-action="open-settings" aria-label="学習設定を開く">${deepIcon("settings", 20)}</button></div>
  </div></header>`;
};
