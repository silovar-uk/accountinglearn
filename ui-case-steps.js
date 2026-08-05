function renderStep(data,page,step,index) {
  const answer=state.answers[step.id]||{}; const typeNames={singleChoice:"1つ選ぶ",multipleChoice:"複数選ぶ",highlightAnomaly:"変化を見つける",formulaBuilder:"計算する",journalEntry:"仕訳する",proposalBuilder:"提案する"};
  return `<section class="card step-card ${answer.checked?answer.correct?"answered is-correct":"answered is-incorrect":""}" data-step-id="${step.id}"><div class="step-heading"><span class="step-number">${index+1}</span><div><small>${typeNames[step.type]||"考える"}</small><h3>${escapeHtml(step.instruction)}</h3></div>${answer.checked?`<span class="step-result-icon">${navIcon(answer.correct?"check":"alert",20)}</span>`:""}</div>${renderStepInput(data,step,answer)}${answer.checked?renderFeedback(answer):""}${step.type!=="proposalBuilder"?`<div class="step-actions"><button class="btn btn-primary" data-action="check-answer" data-case-id="${data.id}" data-page-id="${page.id}" data-step-id="${step.id}" ${isAnswerReady(step,answer)?"":"disabled"}>${answer.checked?"もう一度確認":"答えを確認"}</button></div>`:""}</section>`;
}

function renderFeedback(answer) {
  return `<div class="feedback ${answer.correct?"success":"error"}"><span>${navIcon(answer.correct?"check":"alert",22)}</span><div><strong>${answer.correct?"その視点でOK":"ここを確認"}</strong><p>${escapeHtml(answer.feedback)}</p></div></div>`;
}

function renderResult(data,page) {
  const score=getCaseScore(data); const completion=getCaseCompletion(data); const tier=[...page.resultTiers].sort((a,b)=>b.minScore-a.minScore).find((item)=>score>=item.minScore)||page.resultTiers.at(-1);
  if (completion.isComplete && !state.completedCases[data.id]) { state.completedCases[data.id]={completedAt:new Date().toISOString(),score}; saveState(); }
  return `<section class="card result-card"><div class="result-badge">${completion.isComplete?navIcon("check",28):navIcon("alert",28)}</div><p class="eyebrow">CASE RESULT</p><div class="result-score" style="--score:${score}"><span>${score}<small>点</small></span></div><h2>${completion.isComplete?escapeHtml(tier.title):"未確認の設問があります"}</h2><p>${completion.isComplete?escapeHtml(tier.message):`あと${completion.required-completion.completed}項目を確認すると、ケース完了になります。`}</p>${!completion.isComplete?`<button class="btn btn-primary" data-action="open-case" data-case-id="${data.id}" data-page="0">最初から確認する</button>`:""}</section>`;
}

