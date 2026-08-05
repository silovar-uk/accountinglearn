function renderRecords() {
  return `<div class="page-heading"><span class="page-heading-icon">${navIcon("records",25)}</span><div><p class="eyebrow">RECORDS</p><h1 class="page-title">学習記録</h1><p class="page-lead">回答と進捗は、このブラウザへ自動保存されています。</p></div></div>
    <section class="record-overview"><div><span>${navIcon("cases",21)}</span><strong>${getCompletedCount()}</strong><small>完了ケース</small></div><div><span>${navIcon("trend",21)}</span><strong>${getAverageScore()}%</strong><small>理解スコア</small></div><div><span>${navIcon("review",21)}</span><strong>${state.mistakes.length}</strong><small>復習候補</small></div></section>
    ${catalog.map(({data})=>renderRecordCard(data)).join("")}
    <section class="card data-card"><span class="data-card-icon">${navIcon("download",24)}</span><div><h2>学習データ</h2><p>JSONでバックアップできます。端末を変える前にも保存しておくと安心です。</p></div><div class="data-actions"><button class="btn btn-primary" data-action="export-state">${navIcon("download",18)}書き出す</button><button class="btn btn-ghost danger-text" data-action="reset-state">${navIcon("trash",18)}記録を削除</button></div></section>`;
}

function renderRecordCard(data) {
  const score=getCaseScore(data); const complete=Boolean(state.completedCases[data.id]); const pageIndex=state.caseProgress[data.id]||0; const pageProgress=Math.round(((pageIndex+1)/data.pages.length)*100);
  return `<section class="card record-card"><div class="record-card-head"><span class="case-number">${String(data.releaseOrder||1).padStart(2,"0")}</span><div><small>${complete?"COMPLETED":"IN PROGRESS"}</small><h2>${escapeHtml(data.title)}</h2></div><span class="record-score">${score}<small>点</small></span></div><div class="record-meters"><div><span>ページ進捗</span><strong>${Math.min(pageProgress,100)}%</strong><i><b style="width:${Math.min(pageProgress,100)}%"></b></i></div><div><span>理解スコア</span><strong>${score}%</strong><i><b style="width:${score}%"></b></i></div></div><button class="text-action" data-action="open-case" data-case-id="${data.id}" data-page="${pageIndex}">${complete?"振り返る":"続きから再開"} ${navIcon("arrowRight",17)}</button></section>`;
}

