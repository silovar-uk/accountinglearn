renderHome = function renderDeepHome() {
  const featured = catalog[0].data;
  const started = Boolean(state.visitedPages[featured.id]?.length);
  const resumeIndex = started ? getSmartResumeIndex(featured) : 0;
  const completion = getCaseCompletion(featured);
  const streak = getLearningStreak();
  const today = getTodayCompletedSteps();
  const goal = Number(state.settings.dailyGoal || 1);
  const goalProgress = Math.min(100, Math.round((today / goal) * 100));
  const currentPage = featured.pages[resumeIndex];
  return `<section class="deep-home-hero">
      <div class="deep-hero-copy"><span class="deep-kicker">${started ? "CONTINUE YOUR CASE" : "START YOUR FIRST CASE"}</span><h1>${started ? "続きは、ここから。" : "数字を、経営の言葉に変える。"}</h1><p>${started ? `次は「${escapeHtml(currentPage.title)}」。途中の考えも端末に保存されています。` : "短い物語と実際の数字を使い、簿記を経営判断につなげます。"}</p></div>
      <div class="daily-goal-card"><div class="goal-ring" style="--goal:${goalProgress}"><span>${deepIcon("target", 23)}<strong>${today}</strong><small>/${goal}</small></span></div><div><strong>${today >= goal ? "今日の目標を達成" : "今日の目標"}</strong><p>${today >= goal ? "よく進みました。復習するか、次のページへ。" : `あと${goal - today}問確認すると達成です。`}</p></div></div>
    </section>
    <section class="resume-card">
      <div class="resume-case-no">CASE<br><strong>01</strong></div><div class="resume-content"><span>${completion.completed}/${completion.required}項目完了</span><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(currentPage.title)} ・ 残り約${getRemainingMinutes(featured, resumeIndex)}分</p><div class="resume-progress"><i style="width:${completion.required ? Math.round(completion.completed / completion.required * 100) : 0}%"></i></div></div><button class="deep-button accent" data-action="open-case" data-case-id="${featured.id}" data-page="${resumeIndex}">${started ? "続きから" : "始める"}${deepIcon("arrow", 19)}</button>
    </section>
    <div class="deep-stat-grid"><article><span>${deepIcon("flame")}</span><strong>${streak.current}</strong><small>連続学習日</small></article><article><span>${deepIcon("target")}</span><strong>${getAverageScore()}%</strong><small>理解スコア</small></article><article><span>${deepIcon("history")}</span><strong>${state.mistakes.length}</strong><small>復習候補</small></article></div>
    <div class="section-head"><h2>学び方</h2><small>${state.settings.learningMode === "beginner" ? "やさしい補助つき" : state.settings.learningMode === "practical" ? "実務に近い表示" : "標準モード"}</small></div>
    <section class="learning-mode-strip"><article><span>1</span><div><strong>物語を読む</strong><small>経営者の困りごとを理解</small></div></article><article><span>2</span><div><strong>数字を調べる</strong><small>資料をタップして計算</small></div></article><article><span>3</span><div><strong>提案する</strong><small>原因と打ち手をつなぐ</small></div></article></section>`;
};

renderCaseView = function renderDeepCaseView(caseId, rawPageIndex) {
  const data = getCase(caseId);
  const pageIndex = clamp(rawPageIndex, 0, data.pages.length - 1);
  const page = data.pages[pageIndex];
  const previousProgress = state.caseProgress[data.id] || 0;
  const wasVisited = state.visitedPages[data.id]?.includes(page.id);
  state.lastCaseId = data.id;
  state.lastPageIndex = pageIndex;
  state.caseProgress[data.id] = Math.max(previousProgress, pageIndex);
  state.visitedPages[data.id] = [...new Set([...(state.visitedPages[data.id] || []), page.id])];
  if (!wasVisited || previousProgress !== state.caseProgress[data.id]) saveState();
  const completion = getPageCompletion(data, page);
  return `<main class="main case-main deep-case-layout">
    <aside class="case-outline" aria-label="ケースのページ一覧"><div class="outline-heading"><span>CASE 01</span><strong>調査ファイル</strong></div>${renderCaseOutline(data, pageIndex)}</aside>
    <section class="case-workspace"><header class="case-page-heading"><div class="case-page-kicker"><span>PAGE ${String(pageIndex + 1).padStart(2, "0")}</span><span>${completion.isComplete ? `${deepIcon("check", 14)} 完了` : completion.required ? `${completion.completed}/${completion.required}項目` : "読むページ"}</span><span>残り約${getRemainingMinutes(data, pageIndex)}分</span></div><h1 class="page-title">${escapeHtml(page.title)}</h1>${page.intro ? `<p class="page-lead">${escapeHtml(page.intro)}</p>` : ""}</header>${renderPageBody(data, page)}${renderCaseFooter(data, pageIndex)}</section>
  </main>`;
};

function renderCaseOutline(data, activeIndex) {
  return `<ol>${data.pages.map((page, index) => {
    const completion = getPageCompletion(data, page);
    const unlocked = canNavigateToCasePage(data, index);
    return `<li><button data-action="go-page" data-case-id="${data.id}" data-page="${index}" class="${index === activeIndex ? "active" : ""} ${completion.isComplete ? "complete" : ""}" ${unlocked ? "" : "disabled"}><span>${completion.isComplete ? deepIcon("check", 15) : String(index + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(page.title)}</strong><small>${completion.isComplete ? "完了" : index === activeIndex ? "現在のページ" : unlocked ? "未完了" : "前のページを完了"}</small></div></button></li>`;
  }).join("")}</ol>`;
}
