function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "navigate") location.hash = `#${target.dataset.target}`;
  if (action === "close-case") location.hash = "#cases";
  if (action === "open-case" || action === "change-page") openCase(target.dataset.caseId, Number(target.dataset.page || 0));
  if (action === "finish-case") location.hash = "#records";
  if (action === "select-option") selectOption(target);
  if (action === "check-answer") checkAnswer(target);
  if (action === "use-calculation") useCalculation(target.dataset.stepId, Number(target.dataset.value));
  if (action === "copy-number") copyNumber(target.dataset.value);
  if (action === "export-state") exportState();
  if (action === "reset-state") resetState();
}

function handleInput(event) {
  const element = event.target;
  if (element.dataset.answerInput) {
    const stepId = element.dataset.answerInput;
    const answer = state.answers[stepId] || {};
    answer.value = element.value === "" ? "" : Number(element.value);
    answer.checked = false;
    state.answers[stepId] = answer;
    saveState();
    updateCheckButton(stepId);
  }

  if (element.dataset.answerField) {
    const stepId = element.dataset.answerField;
    const answer = state.answers[stepId] || { value: {} };
    answer.value ||= {};
    const numeric = ["debitAmount", "creditAmount"].includes(element.dataset.field);
    answer.value[element.dataset.field] = numeric && element.value !== "" ? Number(element.value) : element.value;
    answer.checked = false;
    state.answers[stepId] = answer;
    saveState();
    updateCheckButton(stepId);
  }

  if (element.dataset.proposalField) {
    const stepId = element.dataset.proposalField;
    const answer = state.answers[stepId] || { value: {} };
    answer.value ||= {};
    answer.value[element.dataset.field] = element.value;
    state.answers[stepId] = answer;
    saveState();
  }

  if (element.dataset.reviewCheck) {
    const caseId = element.dataset.reviewCheck;
    const index = Number(element.dataset.reviewIndex);
    const selected = new Set(state.proposalReview[caseId] || []);
    element.checked ? selected.add(index) : selected.delete(index);
    state.proposalReview[caseId] = [...selected];
    saveState();
  }
}

function openCase(caseId, pageIndex) {
  const data = getCase(caseId);
  const safeIndex = clamp(pageIndex, 0, data.pages.length - 1);
  location.hash = `#case/${caseId}/${safeIndex}`;
}

function selectOption(button) {
  const stepId = button.dataset.stepId;
  const optionId = button.dataset.optionId;
  const multiple = button.dataset.multiple === "true";
  const answer = state.answers[stepId] || {};
  if (multiple) {
    const selected = new Set(answer.value || []);
    selected.has(optionId) ? selected.delete(optionId) : selected.add(optionId);
    answer.value = [...selected];
  } else {
    answer.value = optionId;
  }
  answer.checked = false;
  state.answers[stepId] = answer;
  saveState();
  render();
}

function useCalculation(stepId, value) {
  const answer = state.answers[stepId] || {};
  answer.value = value;
  answer.checked = false;
  state.answers[stepId] = answer;
  saveState();
  render();
  showToast("計算結果を入力しました");
}

function checkAnswer(button) {
  const data = getCase(button.dataset.caseId);
  const page = data.pages.find((entry) => entry.id === button.dataset.pageId);
  const step = page.steps.find((entry) => entry.id === button.dataset.stepId);
  const result = gradeStep(step, state.answers[step.id]?.value);
  state.answers[step.id] = {
    ...(state.answers[step.id] || {}),
    checked: true,
    correct: result.correct,
    score: result.score,
    maxScore: result.maxScore,
    feedback: result.feedback,
    checkedAt: new Date().toISOString(),
  };

  state.mistakes = state.mistakes.filter((item) => item.stepId !== step.id);
  if (!result.correct) {
    state.mistakes.push({
      caseId: data.id,
      pageId: page.id,
      stepId: step.id,
      instruction: step.instruction,
      feedback: result.feedback,
      createdAt: new Date().toISOString(),
    });
  }
  saveState();
  render();
}

function gradeStep(step, value) {
  const maxScore = step.scoring?.maxPoints || 0;
  if (step.type === "singleChoice") {
    const correct = value === step.correctOptionId;
    return { correct, score: correct ? maxScore : 0, maxScore, feedback: step.feedback?.[value] || step.feedback?.default || (correct ? "正解です。" : "もう一度確認しましょう。") };
  }

  if (step.type === "multipleChoice" && step.correctOptionIds) {
    const selected = value || [];
    const correctCount = selected.filter((id) => step.correctOptionIds.includes(id)).length;
    const exact = sameSet(selected, step.correctOptionIds);
    const score = Math.min(maxScore, correctCount * (step.scoring?.perCorrect || 0));
    const feedback = exact ? step.feedback.allCorrect : correctCount ? step.feedback.partial : step.feedback.incorrect;
    return { correct: exact, score, maxScore, feedback };
  }

  if (step.type === "multipleChoice" && step.preferredOptionIds) {
    const selected = value || [];
    const score = Math.min(maxScore, selected.reduce((total, id) => total + (step.preferredOptionIds.includes(id) ? 5 : step.acceptableAlternativeIds?.includes(id) ? 3 : 0), 0));
    const hasPoor = selected.some((id) => step.options.find((option) => option.id === id)?.category === "poor");
    const correct = score >= 13 && !hasPoor;
    const feedback = selected.map((id) => step.feedbackBySelection[id]).filter(Boolean).join(" ") || "施策を選んでください。";
    return { correct, score, maxScore, feedback };
  }

  if (step.type === "highlightAnomaly") {
    const selected = value || [];
    const correctCount = selected.filter((id) => step.correctValueIds.includes(id)).length;
    const exact = sameSet(selected, step.correctValueIds);
    const score = Math.min(maxScore, correctCount * (step.scoring?.perCorrect || 0));
    return { correct: exact, score, maxScore, feedback: exact ? step.feedback.allCorrect : step.feedback.partial };
  }

  if (step.type === "formulaBuilder") {
    const numeric = Number(value);
    const correct = Number.isFinite(numeric) && Math.abs(numeric - step.expected.value) <= (step.expected.tolerance || 0);
    return { correct, score: correct ? maxScore : 0, maxScore, feedback: correct ? step.feedback.correct : step.feedback.incorrect };
  }

  if (step.type === "journalEntry") {
    const expected = step.expectedEntries[0];
    const fields = ["debitAccountId", "debitAmount", "creditAccountId", "creditAmount"];
    const matched = fields.filter((field) => String(value?.[field] ?? "") === String(expected[field])).length;
    const correct = matched === fields.length;
    const score = correct ? maxScore : step.scoring?.partialCredit ? Math.round((matched / fields.length) * maxScore) : 0;
    return { correct, score, maxScore, feedback: correct ? step.feedback.correct : step.feedback.incorrect };
  }

  return { correct: true, score: 0, maxScore, feedback: "保存しました。" };
}

function isAnswerReady(step, answer) {
  if (step.type === "singleChoice") return Boolean(answer.value);
  if (["multipleChoice", "highlightAnomaly"].includes(step.type)) return Array.isArray(answer.value) && answer.value.length > 0;
  if (step.type === "formulaBuilder") return answer.value !== "" && answer.value !== undefined;
  if (step.type === "journalEntry") return ["debitAccountId", "debitAmount", "creditAccountId", "creditAmount"].every((field) => answer.value?.[field] !== "" && answer.value?.[field] !== undefined);
  return true;
}

function updateCheckButton(stepId) {
  const stepElement = document.querySelector(`[data-step-id="${stepId}"]`);
  if (!stepElement) return;
  const button = stepElement.querySelector('[data-action="check-answer"]');
  const step = findStep(stepId);
  if (button && step) button.disabled = !isAnswerReady(step, state.answers[stepId] || {});
}

async function copyNumber(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`${formatNumber(Number(value))} をコピーしました`);
  } catch {
    showToast(`${formatNumber(Number(value))}`);
  }
}

function exportState() {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "Accounting Quest",
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `accounting-quest-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetState() {
  if (!confirm("学習記録をすべて削除します。元に戻せません。")) return;
  state = structuredClone(defaultState);
  saveState();
  render();
  showToast("学習記録を削除しました");
}

function showToast(message) {
  document.querySelector(".toast")?.remove();
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.appendChild(element);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.remove(), 1800);
}

function getCase(caseId) {
  return catalog.find((item) => item.data.id === caseId)?.data || catalog[0].data;
}

function findStep(stepId) {
  for (const { data } of catalog) {
    for (const page of data.pages) {
      const step = page.steps?.find((entry) => entry.id === stepId);
      if (step) return step;
    }
  }
  return null;
}

function findFinancialRow(data, rowId) {
  for (const doc of data.documents) {
    const direct = doc.rows?.find((row) => row.id === rowId);
    if (direct) return direct;
    for (const section of doc.sections || []) {
      const row = section.rows.find((entry) => entry.id === rowId);
      if (row) return row;
    }
  }
  return null;
}

function isCorrectOption(step, optionId) {
  if (step.correctOptionId) return step.correctOptionId === optionId;
  if (step.correctOptionIds) return step.correctOptionIds.includes(optionId);
  if (step.preferredOptionIds) return step.preferredOptionIds.includes(optionId) || step.acceptableAlternativeIds?.includes(optionId);
  return false;
}

function getCaseScore(data) {
  const autoSteps = data.scoring?.autoScoredStepIds || [];
  const earned = autoSteps.reduce((total, id) => total + (state.answers[id]?.score || 0), 0);
  const max = data.scoring?.maxAutoScore || 1;
  return Math.round((earned / max) * 100);
}

function getCompletedCount() {
  return Object.keys(state.completedCases).length;
}

function getAverageScore() {
  const completed = catalog.filter(({ data }) => state.completedCases[data.id]);
  if (!completed.length) return 0;
  return Math.round(sum(completed.map(({ data }) => getCaseScore(data))) / completed.length);
}

function getVisitedPageCount() {
  return Object.values(state.visitedPages).reduce((total, pages) => total + pages.length, 0);
}

function sameSet(a = [], b = []) {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

boot().catch((error) => {
  console.error(error);
  app.innerHTML = `<main class="main"><section class="card"><p class="eyebrow">LOAD ERROR</p><h1 class="page-title">教材を読み込めませんでした</h1><p class="page-lead">HTTPサーバー経由で開いているか、JSONファイルの配置を確認してください。</p><pre>${escapeHtml(error.message)}</pre></section></main>`;
});
