renderStep = function renderDeepStep(data, page, step, index) {
  const answer = state.answers[step.id] || {};
  const attempts = getAttemptHistory(step.id);
  const showHint = Boolean(state.hintsOpen[step.id]) || Boolean(answer.checked && !answer.correct && state.settings.showHintsAfterMistake);
  const isProposal = step.type === "proposalBuilder";
  const proposalValues = isProposal ? (answer.value || {}) : null;
  const proposalRequired = isProposal ? (step.fields || []).filter((field) => field.required) : [];
  const proposalCompleted = isProposal ? proposalRequired.filter((field) => String(proposalValues[field.id] || "").trim()).length : 0;
  const status = isProposal ? (proposalCompleted >= proposalRequired.length ? "correct" : proposalCompleted ? "draft" : "new") : answer.checked ? (answer.correct ? "correct" : "incorrect") : answer.value !== undefined ? "draft" : "new";
  return `<section class="card step-card deep-step ${status}" data-step-id="${step.id}">
    <div class="step-heading"><span class="step-number">${index + 1}</span><div><span class="step-status">${status === "correct" ? "理解できた" : status === "incorrect" ? "もう一度考える" : status === "draft" ? "回答中" : "QUESTION"}</span><h3>${escapeHtml(step.instruction)}</h3></div>${attempts.length ? `<small class="attempt-count">${attempts.length}回回答</small>` : ""}</div>
    ${renderStepInput(data, step, answer)}
    ${showHint ? `<aside class="hint-panel">${deepIcon("hint", 20)}<div><strong>考えるヒント</strong><p>${escapeHtml(getHintForStep(step))}</p></div></aside>` : ""}
    ${answer.checked ? renderFeedback(answer, step) : ""}
    <div class="deep-step-actions">
      ${isProposal ? `<span class="proposal-save-note">${deepIcon("save", 17)}入力内容は自動保存</span><span class="proposal-progress">${proposalCompleted}/${proposalRequired.length}項目</span>` : !answer.checked ? `<button class="text-action" data-action="toggle-hint" data-step-id="${step.id}">${deepIcon("hint", 17)}${showHint ? "ヒントを閉じる" : "ヒントを見る"}</button><button class="deep-button primary" data-action="check-answer" data-case-id="${data.id}" data-page-id="${page.id}" data-step-id="${step.id}" ${isAnswerReady(step, answer) ? "" : "disabled"}>答えを確認</button>` : answer.correct ? `<span class="correct-complete">${deepIcon("check", 18)}この設問は完了しました</span>` : `<button class="text-action" data-action="toggle-hint" data-step-id="${step.id}">${deepIcon("hint", 17)}ヒントを確認</button><button class="deep-button primary" data-action="retry-step" data-step-id="${step.id}">${deepIcon("retry", 18)}もう一度解く</button>`}
    </div>
  </section>`;
};

renderFeedback = function renderDeepFeedback(answer) {
  return `<div class="deep-feedback ${answer.correct ? "success" : "error"}" role="status"><span>${deepIcon(answer.correct ? "check" : "alert", 23)}</span><div><strong>${answer.correct ? "その考え方で正解です" : "ここを整理すると見えてきます"}</strong><p>${escapeHtml(answer.feedback)}</p></div></div>`;
};

renderFormula = function renderDeepFormula(step, answer) {
  const helper = formulaHelper(step.id);
  const beginner = state.settings.learningMode === "beginner";
  return `<div class="formula-box deep-formula"><span class="formula-hint">使う式</span><strong>${escapeHtml(step.formula.template)}</strong>${beginner && helper ? `<p><span>資料の数字を当てはめると</span>${escapeHtml(helper.expression.replace(/\s*[＝=].*$/, ""))}</p>` : ""}</div>
    <div class="field-grid"><div class="field"><label for="input-${step.id}">計算結果（${escapeHtml(step.expected.unit)}）</label><div class="input-with-action"><input id="input-${step.id}" type="number" inputmode="decimal" step="any" data-answer-input="${step.id}" value="${answer.value ?? ""}" placeholder="数値を入力"/><button type="button" data-action="open-calculator" data-step-id="${step.id}" aria-label="計算トレイを開く">${deepIcon("calculator", 20)}</button></div></div><button class="deep-button secondary full" data-action="open-calculator" data-step-id="${step.id}">${deepIcon("calculator", 18)}資料の数字を使って計算する</button></div>`;
};

renderFinancialStatement = function renderDeepFinancialStatement(doc) {
  const rows = doc.rows || doc.sections?.flatMap((section) => [{ sectionLabel: section.label }, ...section.rows]) || [];
  const mobileRows = rows.map((row) => {
    if (row.sectionLabel) return `<h4 class="mobile-section-label">${escapeHtml(row.sectionLabel)}</h4>`;
    const delta = row.values.length >= 2 ? Number(row.values.at(-1)) - Number(row.values[0]) : null;
    return `<article class="financial-mobile-row"><div class="financial-row-heading"><strong>${escapeHtml(row.label)}</strong>${delta !== null ? `<span class="delta-chip ${delta < 0 ? "down" : delta > 0 ? "up" : "flat"}">${delta > 0 ? "+" : ""}${formatNumber(delta)}</span>` : ""}</div><div>${row.values.map((value, index) => `<button class="mobile-value" data-action="copy-number" data-value="${value}" data-label="${escapeHtml(row.label)}・${escapeHtml(doc.periods[index])}" data-unit="${escapeHtml(doc.unit)}"><small>${escapeHtml(doc.periods[index])}</small><b>${formatNumber(value)}</b><em>${escapeHtml(doc.unit)}</em><span>計算に使う</span></button>`).join("")}</div></article>`;
  }).join("");
  return `<section class="card document-card deep-document-card"><header><div><span class="document-type">FINANCIAL STATEMENT</span><h3>${escapeHtml(doc.title)}</h3></div><small>単位：${escapeHtml(doc.unit)}</small></header><div class="document-tip">数字をタップすると、計算トレイへ送れます。</div><div class="desktop-financial-table table-scroll"><table><thead><tr><th>科目</th>${doc.periods.map((period) => `<th>${escapeHtml(period)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => row.sectionLabel ? `<tr class="section-row"><td colspan="${doc.periods.length + 1}">${escapeHtml(row.sectionLabel)}</td></tr>` : `<tr><td>${escapeHtml(row.label)}</td>${row.values.map((value, index) => `<td><button class="value-button" data-action="copy-number" data-value="${value}" data-label="${escapeHtml(row.label)}・${escapeHtml(doc.periods[index])}" data-unit="${escapeHtml(doc.unit)}">${formatNumber(value)}</button></td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="mobile-financial-list">${mobileRows}</div></section>`;
};

renderGenericTable = function renderDeepGenericTable(doc) {
  return `<section class="card document-card deep-document-card"><header><div><span class="document-type">DETAIL TABLE</span><h3>${escapeHtml(doc.title)}</h3></div><small>単位：${escapeHtml(doc.unit || "-")}</small></header><div class="desktop-financial-table table-scroll"><table><thead><tr>${doc.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${doc.rows.map((row) => `<tr>${doc.columns.map((column) => `<td>${typeof row[column.id] === "number" ? `<button class="value-button" data-action="copy-number" data-value="${row[column.id]}" data-label="${escapeHtml(column.label)}" data-unit="${escapeHtml(doc.unit || "")}">${formatNumber(row[column.id])}</button>` : escapeHtml(String(row[column.id] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="mobile-generic-list">${doc.rows.map((row, rowIndex) => `<article><span class="row-index">${String(rowIndex + 1).padStart(2, "0")}</span>${doc.columns.map((column) => `<div><small>${escapeHtml(column.label)}</small>${typeof row[column.id] === "number" ? `<button data-action="copy-number" data-value="${row[column.id]}" data-label="${escapeHtml(column.label)}" data-unit="${escapeHtml(doc.unit || "")}">${formatNumber(row[column.id])}<em>${escapeHtml(doc.unit || "")}</em><span>計算に使う</span></button>` : `<strong>${escapeHtml(String(row[column.id] ?? ""))}</strong>`}</div>`).join("")}</article>`).join("")}</div></section>`;
};

renderCaseFooter = function renderDeepCaseFooter(data, pageIndex) {
  const page = data.pages[pageIndex];
  const completion = getPageCompletion(data, page);
  const last = pageIndex === data.pages.length - 1;
  const caseCompletion = getCaseCompletion(data);
  const requirements = getPageRequirementLabels(page);
  const disabled = last ? !caseCompletion.isComplete : !completion.isComplete;
  return `<nav class="case-footer deep-case-footer" aria-label="ケースページ移動"><button class="footer-nav-button secondary" data-action="go-page" data-case-id="${data.id}" data-page="${pageIndex - 1}" ${pageIndex === 0 ? "disabled" : ""}>${deepIcon("back", 19)}<span>前へ</span></button><button class="footer-page-status" data-action="open-page-map"><strong>${pageIndex + 1}<small> / ${data.pages.length}</small></strong><span>${completion.isComplete ? "ページ完了" : requirements[0] || "読むページ"}</span><em>一覧</em></button><button class="footer-nav-button primary" data-action="${last ? "finish-case" : "go-page"}" data-case-id="${data.id}" data-page="${pageIndex + 1}" ${disabled ? "disabled" : ""}><span>${last ? "記録を見る" : "次へ"}</span>${deepIcon("arrow", 19)}</button></nav>`;
};

