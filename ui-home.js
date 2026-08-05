function renderHome() {
  const featured = catalog[0].data;
  const pageIndex = state.caseProgress[featured.id] || 0;
  const started = Boolean(state.visitedPages[featured.id]);
  const completed = Boolean(state.completedCases[featured.id]);
  const progress = Math.round(((Math.min(pageIndex, featured.pages.length - 1) + (started ? 1 : 0)) / featured.pages.length) * 100);
  const nextPage = featured.pages[clamp(pageIndex, 0, featured.pages.length - 1)];
  const buttonLabel = completed ? "ケースを振り返る" : started ? "続きから再開" : "最初のケースを始める";
  return `<section class="home-intro">
      <div><p class="eyebrow">PRACTICAL ACCOUNTING</p><h1 class="home-title">数字を読んで、<br><span>経営を動かす。</span></h1></div>
      <div class="daily-orb"><strong>${getCompletedCount()}</strong><small>CASE</small></div>
    </section>

    <section class="hero-card learning-hero">
      <div class="hero-copy">
        <div class="hero-kicker"><span>CASE ${String(featured.releaseOrder || 1).padStart(2, "0")}</span><span>${completed ? "完了" : started ? `${progress}%` : "NEW"}</span></div>
        <h2 class="hero-title">${escapeHtml(featured.title)}</h2>
        <p>${escapeHtml(featured.subtitle)}</p>
        <div class="case-meta"><span>${navIcon("clock", 16)}約${featured.estimatedMinutes}分</span><span>${navIcon("document", 16)}${featured.pages.length}ページ</span><span>${navIcon("trend", 16)}難易度 ${featured.difficulty}</span></div>
        ${started ? `<div class="hero-progress"><div class="progress-label"><span>${escapeHtml(nextPage?.title || "続き")}</span><span>${progress}%</span></div><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div></div>` : ""}
        <button class="btn btn-accent hero-main-action" data-action="open-case" data-case-id="${featured.id}" data-page="${pageIndex}">${navIcon("play", 20)}${buttonLabel}</button>
      </div>
      <div class="hero-visual" aria-hidden="true"><div class="hero-ledger"><span></span><span></span><span></span><div class="hero-chart"><i></i><i></i><i></i><i></i></div></div><div class="hero-coin">¥</div></div>
    </section>

    <section class="quick-stats" aria-label="学習状況">
      <div><span class="quick-icon mint">${navIcon("cases", 20)}</span><p><strong>${getCompletedCount()}</strong><small>ケース完了</small></p></div>
      <div><span class="quick-icon gold">${navIcon("trend", 20)}</span><p><strong>${getAverageScore()}%</strong><small>理解スコア</small></p></div>
      <div><span class="quick-icon coral">${navIcon("review", 20)}</span><p><strong>${state.mistakes.length}</strong><small>復習候補</small></p></div>
    </section>

    <div class="section-head"><div><p class="eyebrow">NEXT ACTION</p><h2>今日の一歩</h2></div><small>3〜8分から</small></div>
    <section class="card next-action-card">
      <span class="next-action-icon">${navIcon(started ? "arrowRight" : "calculator", 25)}</span>
      <div><h3>${started ? escapeHtml(nextPage?.title || "ケースを続ける") : "利益と現金の違いをつかむ"}</h3><p>${started ? `CASE 1・${pageIndex + 1}/${featured.pages.length}ページ` : "売掛金と設備投資から、黒字でも現金が減る理由を追います。"}</p></div>
      <button class="circle-action" data-action="open-case" data-case-id="${featured.id}" data-page="${pageIndex}" aria-label="${buttonLabel}">${navIcon("arrowRight", 22)}</button>
    </section>

    <div class="section-head"><div><p class="eyebrow">SKILLS</p><h2>身につく力</h2></div></div>
    <div class="skill-grid"><article><span>01</span><strong>財務三表をつなぐ</strong><small>利益と現金を分けて読む</small></article><article><span>02</span><strong>数字から仮説を作る</strong><small>変化の理由を掘り下げる</small></article><article><span>03</span><strong>施策へ落とし込む</strong><small>経営者が動ける提案にする</small></article></div>`;
}

