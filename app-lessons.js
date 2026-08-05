function renderStep(data, page, step, index) {
  const answer = state.answers[step.id] || {};
  return `<section class="card step-card ${answer.checked ? "answered" : ""}" data-step-id="${step.id}">
    <h3><span class="step-number">${index + 1}</span>${escapeHtml(step.instruction)}</h3>
    ${renderStepInput(data, step, answer)}
    ${answer.checked ? renderFeedback(answer) : ""}
    ${step.type !== "proposalBuilder" ? `<div class="step-actions"><button class="btn btn-primary" data-action="check-answer" data-case-id="${data.id}" data-page-id="${page.id}" data-step-id="${step.id}" ${isAnswerReady(step, answer) ? "" : "disabled"}>答えを確認</button></div>` : ""}
  </section>`;
}

function renderStepInput(data, step, answer) {
  if (step.type === "singleChoice") return renderChoiceOptions(step, answer, false);
  if (step.type === "multipleChoice") return renderChoiceOptions(step, answer, true);
  if (step.type === "highlightAnomaly") return renderAnomalyOptions(data, step, answer);
  if (step.type === "formulaBuilder") return renderFormula(step, answer);
  if (step.type === "journalEntry") return renderJournal(step, answer);
  if (step.type === "proposalBuilder") return renderProposal(step, answer);
  return `<p>この問題形式は準備中です。</p>`;
}

function renderChoiceOptions(step, answer, multiple) {
  const selected = new Set(answer.value || []);
  return `<div class="option-grid">${step.options.map((option) => {
    const isSelected = multiple ? selected.has(option.id) : answer.value === option.id;
    const correctnessClass = answer.checked
      ? isCorrectOption(step, option.id) ? "correct" : isSelected ? "incorrect" : ""
      : "";
    return `<button class="option ${isSelected ? "selected" : ""} ${correctnessClass}" data-action="select-option" data-step-id="${step.id}" data-option-id="${option.id}" data-multiple="${multiple}">${escapeHtml(option.label)}</button>`;
  }).join("")}</div>`;
}

function renderAnomalyOptions(data, step, answer) {
  const selected = new Set(answer.value || []);
  return `<div class="option-grid">${step.selectableValueIds.map((id) => {
    const info = findFinancialRow(data, id);
    const isSelected = selected.has(id);
    const correct = step.correctValueIds.includes(id);
    const correctnessClass = answer.checked ? correct ? "correct" : isSelected ? "incorrect" : "" : "";
    return `<button class="option ${isSelected ? "selected" : ""} ${correctnessClass}" data-action="select-option" data-step-id="${step.id}" data-option-id="${id}" data-multiple="true">
      ${escapeHtml(info?.label || id)}${info?.values ? `　${formatNumber(info.values[0])} → ${formatNumber(info.values.at(-1))}` : ""}
    </button>`;
  }).join("")}</div>`;
}

function renderFormula(step, answer) {
  const helper = formulaHelper(step.id);
  return `<div class="formula-box"><span class="formula-hint">計算式</span>${escapeHtml(step.formula.template)}${helper ? `<br><span class="formula-hint">数字を入れると</span>${escapeHtml(helper.expression)}` : ""}</div>
    <div class="field-grid">
      <div class="field"><label for="input-${step.id}">計算結果（${escapeHtml(step.expected.unit)}）</label><input id="input-${step.id}" type="number" inputmode="decimal" step="any" data-answer-input="${step.id}" value="${answer.value ?? ""}" placeholder="数値を入力" /></div>
      ${helper ? `<button class="btn btn-ghost btn-block" data-action="use-calculation" data-step-id="${step.id}" data-value="${helper.value}">計算補助を使う</button>` : ""}
    </div>`;
}

function formulaHelper(stepId) {
  if (stepId === "step-04-01") return { expression: "2,600 ÷ 10,400 × 365", value: 91.25 };
  if (stepId === "step-06-01") return { expression: "620 ＋ 300 － 1,120", value: -200 };
  return null;
}

function renderJournal(step, answer) {
  const value = answer.value || {};
  return `<div class="field-grid">
    <div class="two-col">
      <div class="field"><label>借方科目</label><select data-answer-field="${step.id}" data-field="debitAccountId"><option value="">選択</option>${step.accountChoices.map((account) => `<option value="${account.id}" ${value.debitAccountId === account.id ? "selected" : ""}>${escapeHtml(account.label)}</option>`).join("")}</select></div>
      <div class="field"><label>借方金額（${escapeHtml(step.unit)}）</label><input type="number" inputmode="numeric" data-answer-field="${step.id}" data-field="debitAmount" value="${value.debitAmount ?? ""}" /></div>
    </div>
    <div class="two-col">
      <div class="field"><label>貸方科目</label><select data-answer-field="${step.id}" data-field="creditAccountId"><option value="">選択</option>${step.accountChoices.map((account) => `<option value="${account.id}" ${value.creditAccountId === account.id ? "selected" : ""}>${escapeHtml(account.label)}</option>`).join("")}</select></div>
      <div class="field"><label>貸方金額（${escapeHtml(step.unit)}）</label><input type="number" inputmode="numeric" data-answer-field="${step.id}" data-field="creditAmount" value="${value.creditAmount ?? ""}" /></div>
    </div>
  </div>`;
}

function renderProposal(step, answer) {
  const values = answer.value || {};
  return `<div class="field-grid">${step.fields.map((field) => `<div class="field"><label for="${field.id}">${escapeHtml(field.label)}</label><textarea id="${field.id}" data-proposal-field="${step.id}" data-field="${field.id}" placeholder="${escapeHtml(field.placeholder)}">${escapeHtml(values[field.id] || "")}</textarea></div>`).join("")}
    <div class="feedback info">文章は自動採点しません。エピローグで模範分析と照らし合わせ、自己評価します。</div>
  </div>`;
}

function renderFeedback(answer) {
  return `<div class="feedback ${answer.correct ? "success" : "error"}">${escapeHtml(answer.feedback)}</div>`;
}

function renderResult(data, page) {
  const score = getCaseScore(data);
  const tier = [...page.resultTiers].sort((a, b) => b.minScore - a.minScore).find((item) => score >= item.minScore) || page.resultTiers.at(-1);
  if (!state.completedCases[data.id]) {
    state.completedCases[data.id] = { completedAt: new Date().toISOString(), score };
    saveState();
  }
  return `<section class="card" style="text-align:center">
    <p class="eyebrow">CASE RESULT</p>
    <div class="result-score" style="--score:${score}"><span>${score}%</span></div>
    <h2>${escapeHtml(tier.title)}</h2>
    <p class="page-lead">${escapeHtml(tier.message)}</p>
  </section>`;
}

function renderModelAnalysis(analysis) {
  return `<section class="card">
    <p class="eyebrow">MODEL ANALYSIS</p>
    <h2>模範分析</h2>
    <p class="page-lead">${escapeHtml(analysis.summary)}</p>
    ${analysis.keyFindings.map((finding) => `<div style="padding:14px 0;border-top:1px solid var(--line)"><strong>${escapeHtml(finding.title)}</strong><p class="page-lead" style="margin:6px 0 0">${escapeHtml(finding.evidence)}</p></div>`).join("")}
    <h3>推奨アクション</h3>
    <ul class="mission-list">${analysis.recommendedActions.map((item) => `<li><strong>${escapeHtml(item.horizon)}</strong>：${escapeHtml(item.action)}</li>`).join("")}</ul>
  </section>`;
}

function renderSelfReview(data, page) {
  const selected = new Set(state.proposalReview[data.id] || []);
  return `<section class="card">
    <p class="eyebrow">SELF REVIEW</p><h2>自分の提案を確認</h2>
    <div class="check-list">${page.review.checklist.map((item, index) => `<label class="check-row"><input type="checkbox" data-review-check="${data.id}" data-review-index="${index}" ${selected.has(index) ? "checked" : ""}/><span>${escapeHtml(item)}</span></label>`).join("")}</div>
  </section>`;
}

function renderCaseFooter(data, pageIndex) {
  const last = pageIndex === data.pages.length - 1;
  return `<nav class="case-footer" aria-label="ケースページ移動">
    <button class="btn btn-ghost" data-action="change-page" data-case-id="${data.id}" data-page="${pageIndex - 1}" ${pageIndex === 0 ? "disabled" : ""}>前へ</button>
    <span class="page-count">${pageIndex + 1} / ${data.pages.length}</span>
    <button class="btn ${last ? "btn-accent" : "btn-primary"}" data-action="${last ? "finish-case" : "change-page"}" data-case-id="${data.id}" data-page="${pageIndex + 1}">${last ? "記録を見る" : "次へ"}</button>
  </nav>`;
}

function renderBottomNav(active) {
  const items = [
    ["home", "⌂", "ホーム"],
    ["cases", "▦", "ケース"],
    ["basics", "◇", "基礎"],
    ["review", "↻", "復習"],
    ["records", "▥", "記録"],
  ];
  return `<nav class="bottom-nav" aria-label="メインメニュー"><div class="bottom-nav-inner">${items.map(([id, icon, label]) => `<button class="nav-item ${active === id ? "active" : ""}" data-action="navigate" data-target="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join("")}</div></nav>`;
}
