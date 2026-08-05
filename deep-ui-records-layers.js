renderRecords = function renderDeepRecords() {
  const attempts = getAttemptStats();
  const streak = getLearningStreak();
  return `<p class="eyebrow">LEARNING RECORD</p><h1 class="page-title">学習記録</h1><p class="page-lead">正解率だけでなく、考え直した回数と継続も記録します。</p>
    <div class="deep-record-stats"><article><span>${deepIcon("flame")}</span><strong>${streak.current}<small>日</small></strong><p>現在の連続学習</p></article><article><span>${deepIcon("target")}</span><strong>${attempts.firstTryAccuracy}<small>%</small></strong><p>初回正答率</p></article><article><span>${deepIcon("history")}</span><strong>${attempts.total}<small>回</small></strong><p>回答した回数</p></article></div>
    ${catalog.map(({ data }) => renderRecordCard(data)).join("")}
    ${(state.calculationHistory || []).length ? `<section class="card"><div class="section-head"><h2>最近の計算</h2><small>直近5件</small></div><div class="record-calculations">${state.calculationHistory.slice(0, 5).map((item) => `<div><span>${escapeHtml(item.expression)}</span><strong>${formatNumber(item.result)}</strong></div>`).join("")}</div></section>` : ""}
    <section class="card data-management"><div><span class="deep-kicker">BACKUP</span><h2>学習データ</h2><p>回答、提案、復習記録をJSONで移動できます。読み込み前には現在の記録を自動で退避します。</p></div><div class="data-actions"><button class="deep-button secondary" data-action="trigger-import">${deepIcon("upload", 18)}JSONを読み込む</button><button class="deep-button primary" data-action="export-state">${deepIcon("download", 18)}JSONを書き出す</button></div><input id="deep-import-file" type="file" accept="application/json,.json" hidden /></section>`;
};

renderReview = function renderDeepReview() {
  if (!state.mistakes.length) return `<p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1><div class="card empty-state deep-empty"><span>${deepIcon("check", 28)}</span><strong>復習候補はありません</strong><p>間違えた設問は、理由と回答回数つきでここに戻ってきます。</p></div>`;
  const items = [...state.mistakes].reverse();
  return `<p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1><p class="page-lead">正解を覚えるのではなく、数字と原因をもう一度つなぎます。</p><div class="deep-review-list">${items.map((item) => {
    const data = getCase(item.caseId);
    const page = data.pages.find((entry) => entry.id === item.pageId);
    const index = data.pages.findIndex((entry) => entry.id === item.pageId);
    const attempts = getAttemptHistory(item.stepId).length;
    return `<article class="card review-card"><div class="review-card-top"><span>${deepIcon("retry", 19)}要復習</span><small>${attempts || 1}回回答</small></div><h2>${escapeHtml(item.instruction)}</h2><p>${escapeHtml(item.feedback || "考え方をもう一度確認しましょう。")}</p><div><span>${escapeHtml(page?.title || "設問")}</span><button class="deep-button primary" data-action="open-case" data-case-id="${item.caseId}" data-page="${index}">復習する${deepIcon("arrow", 17)}</button></div></article>`;
  }).join("")}</div>`;
};

function renderDeepLayers() {
  return `${!navigator.onLine ? `<div class="offline-banner">${deepIcon("offline", 17)}オフラインです。保存済みの教材で学習できます。</div>` : ""}${renderDeepModal()}${renderCalculatorLayer()}`;
}

function renderDeepModal() {
  const modal = !state.onboardingComplete ? "onboarding" : state.ui.modal;
  if (!modal) return "";
  if (modal === "onboarding") return `<div class="deep-backdrop"></div><section class="deep-modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div class="onboarding-visual">${renderBrandMark("AQ")}<span>${deepIcon("target", 30)}</span></div><span class="deep-kicker">WELCOME TO ACCOUNTING QUEST</span><h2 id="onboarding-title">どのくらい補助を使いますか？</h2><p>あとから設定で変更できます。AIは使わず、教材に用意したヒントと計算補助だけで進みます。</p><div class="mode-options">${[["beginner","はじめて","式や考え方を多めに表示"],["standard","標準","必要なヒントだけ表示"],["practical","実務","補助を抑えて自分で組み立てる"]].map(([id,title,copy]) => `<button data-action="select-learning-mode" data-mode="${id}" class="${state.settings.learningMode === id ? "selected" : ""}"><span>${id === "beginner" ? "1" : id === "standard" ? "2" : "3"}</span><div><strong>${title}</strong><small>${copy}</small></div>${state.settings.learningMode === id ? deepIcon("check", 19) : ""}</button>`).join("")}</div><button class="deep-button accent full" data-action="complete-onboarding">この設定で始める</button><small class="privacy-note">回答はこの端末のブラウザ内に保存されます。</small></section>`;
  if (modal === "settings") return `<div class="deep-backdrop" data-action="close-modal"></div><section class="deep-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header class="sheet-header"><div><span class="deep-kicker">SETTINGS</span><h2 id="settings-title">学習設定</h2></div><button class="deep-icon-button" data-action="close-modal" aria-label="閉じる">${deepIcon("close")}</button></header><fieldset><legend>学習モード</legend>${[["beginner","はじめて"],["standard","標準"],["practical","実務"]].map(([id,label]) => `<button data-action="select-learning-mode" data-mode="${id}" class="setting-choice ${state.settings.learningMode === id ? "selected" : ""}">${label}${state.settings.learningMode === id ? deepIcon("check", 17) : ""}</button>`).join("")}</fieldset><fieldset><legend>1日の目標</legend><div class="goal-options">${[1,2,3,5].map((goal) => `<button data-action="set-daily-goal" data-goal="${goal}" class="${Number(state.settings.dailyGoal) === goal ? "selected" : ""}">${goal}問</button>`).join("")}</div></fieldset><label class="switch-row"><span><strong>動きを少なくする</strong><small>アニメーションを抑えます</small></span><input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion ? "checked" : ""}/></label><label class="switch-row"><span><strong>誤答後にヒントを表示</strong><small>間違えた理由を整理しやすくします</small></span><input type="checkbox" data-setting="showHintsAfterMistake" ${state.settings.showHintsAfterMistake ? "checked" : ""}/></label></section>`;
  if (modal === "page-map") {
    const data = getCase(currentView.caseId);
    const active = clamp(currentView.pageIndex, 0, data.pages.length - 1);
    return `<div class="deep-backdrop" data-action="close-modal"></div><section class="deep-modal page-map-modal" role="dialog" aria-modal="true" aria-labelledby="page-map-title"><header class="sheet-header"><div><span class="deep-kicker">CASE MAP</span><h2 id="page-map-title">ページ一覧</h2></div><button class="deep-icon-button" data-action="close-modal" aria-label="閉じる">${deepIcon("close")}</button></header>${renderCaseOutline(data, active)}</section>`;
  }
  if (modal === "exit-confirm") {
    const data = getCase(currentView.caseId);
    const page = data.pages[clamp(currentView.pageIndex, 0, data.pages.length - 1)];
    const missing = getPageRequirementLabels(page);
    return `<div class="deep-backdrop" data-action="close-modal"></div><section class="deep-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="exit-title"><span class="confirm-icon">${deepIcon("alert", 28)}</span><h2 id="exit-title">このページを途中で閉じますか？</h2><p>${missing.length ? `まだ「${escapeHtml(missing[0])}」が残っています。入力内容は保存されます。` : "入力内容は保存されています。"}</p><div><button class="deep-button secondary" data-action="close-modal">学習を続ける</button><button class="deep-button primary" data-action="confirm-close-case">ケース一覧へ</button></div></section>`;
  }
  if (modal === "import-confirm") return `<div class="deep-backdrop" data-action="close-modal"></div><section class="deep-modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="import-title"><span class="confirm-icon success">${deepIcon("upload", 28)}</span><h2 id="import-title">学習データを読み込みますか？</h2><p>現在の記録は先にJSONとして書き出します。読み込んだデータで、この端末の記録を置き換えます。</p><div><button class="deep-button secondary" data-action="close-modal">キャンセル</button><button class="deep-button primary" data-action="confirm-import">バックアップして読み込む</button></div></section>`;
  return "";
}

renderResult = function renderDeepResult(data, page) {
  const score = getCaseScore(data);
  const tier = [...page.resultTiers].sort((a, b) => b.minScore - a.minScore).find((item) => score >= item.minScore) || page.resultTiers.at(-1);
  const completion = getCaseCompletion(data);
  return `<section class="card deep-result-card" style="--result-score:${score}"><div class="deep-result-ring"><span><strong>${score}</strong><small>点</small></span></div><div><span class="deep-kicker">CASE RESULT</span><h2>${escapeHtml(tier.title)}</h2><p>${escapeHtml(tier.message)}</p>${completion.isComplete ? `<span class="result-complete">${deepIcon("check", 17)}全必須項目を完了</span>` : `<span class="result-incomplete">${deepIcon("alert", 17)}未完了の設問があります</span>`}</div></section>`;
};
