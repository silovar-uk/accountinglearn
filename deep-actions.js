const legacySaveState = saveState;
const legacyHandleClick = handleClick;
const legacyHandleInput = handleInput;
const legacyExportState = exportState;
let pendingImportPayload = null;

saveState = function saveDeepState() {
  ensureDeepState();
  state.ui.lastSavedAt = new Date().toISOString();
  state.ui.saveStatus = "saved";
  legacySaveState();
  const indicator = document.querySelector(".save-status span");
  if (indicator) indicator.textContent = getSaveStatusLabel();
};

function announceDeep(message) {
  const region = document.querySelector("#deep-announcer");
  if (!region) return;
  region.textContent = "";
  queueMicrotask(() => { region.textContent = message; });
}

function currentCasePage() {
  if (currentView.name !== "case") return null;
  const data = getCase(currentView.caseId);
  const pageIndex = clamp(currentView.pageIndex, 0, data.pages.length - 1);
  return { data, pageIndex, page: data.pages[pageIndex] };
}

checkAnswer = function checkDeepAnswer(button) {
  const data = getCase(button.dataset.caseId);
  const page = data.pages.find((entry) => entry.id === button.dataset.pageId);
  const step = page?.steps?.find((entry) => entry.id === button.dataset.stepId);
  if (!step) return;
  const value = structuredClone(state.answers[step.id]?.value);
  const result = gradeStep(step, value);
  registerAttempt(step, value, result);
  state.answers[step.id] = {
    ...(state.answers[step.id] || {}),
    checked: true,
    correct: result.correct,
    score: result.score,
    maxScore: result.maxScore,
    feedback: result.feedback,
    checkedAt: new Date().toISOString(),
    firstTryCorrect: getAttemptHistory(step.id)[0]?.correct || false,
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
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    });
    if (state.settings.showHintsAfterMistake) state.hintsOpen[step.id] = true;
  }
  markLearningActivity();
  saveState();
  render();
  announceDeep(result.correct ? "正解です。設問を完了しました。" : "不正解です。ヒントと解説を確認できます。");
  queueMicrotask(() => document.querySelector(`[data-step-id="${step.id}"] .deep-feedback`)?.scrollIntoView({ block: "center", behavior: state.settings.reducedMotion ? "auto" : "smooth" }));
};

handleClick = function handleDeepClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-settings") {
    state.ui.modal = "settings";
    saveState();
    render();
    return;
  }
  if (action === "close-modal") {
    state.ui.modal = null;
    state.ui.importError = null;
    saveState();
    render();
    return;
  }
  if (action === "select-learning-mode") {
    state.settings.learningMode = target.dataset.mode;
    state.selectedLearningMode = target.dataset.mode;
    saveState();
    render();
    return;
  }
  if (action === "set-daily-goal") {
    state.settings.dailyGoal = Number(target.dataset.goal || 1);
    saveState();
    render();
    return;
  }
  if (action === "complete-onboarding") {
    state.onboardingComplete = true;
    markLearningActivity();
    saveState();
    render();
    announceDeep("初期設定が完了しました。");
    return;
  }
  if (action === "open-page-map") {
    state.ui.modal = "page-map";
    saveState();
    render();
    return;
  }
  if (action === "go-page") {
    const data = getCase(target.dataset.caseId);
    const pageIndex = Number(target.dataset.page);
    if (!canNavigateToCasePage(data, pageIndex)) {
      showToast("前のページを完了すると開けます");
      return;
    }
    state.ui.modal = null;
    saveState();
    openCase(data.id, pageIndex);
    return;
  }
  if (action === "request-close-case") {
    const current = currentCasePage();
    if (current && !getPageCompletion(current.data, current.page).isComplete) {
      state.ui.modal = "exit-confirm";
      saveState();
      render();
    } else {
      location.hash = "#cases";
    }
    return;
  }
  if (action === "confirm-close-case") {
    state.ui.modal = null;
    saveState();
    location.hash = "#cases";
    return;
  }
  if (action === "toggle-hint") {
    const stepId = target.dataset.stepId;
    state.hintsOpen[stepId] = !state.hintsOpen[stepId];
    saveState();
    render();
    return;
  }
  if (action === "retry-step") {
    const stepId = target.dataset.stepId;
    const answer = state.answers[stepId] || {};
    state.answers[stepId] = { ...answer, checked: false, correct: false, score: 0 };
    state.hintsOpen[stepId] = true;
    saveState();
    render();
    queueMicrotask(() => document.querySelector(`[data-step-id="${stepId}"] input, [data-step-id="${stepId}"] button.option, [data-step-id="${stepId}"] select`)?.focus());
    return;
  }
  if (action === "open-calculator") {
    openCalculatorForStep(target.dataset.stepId || null);
    return;
  }
  if (action === "copy-number") {
    addCalculatorNumber(Number(target.dataset.value), target.dataset.label || "資料の数値", target.dataset.unit || "");
    announceDeep(`${target.dataset.label || "数値"}を計算トレイに追加しました。`);
    return;
  }
  if (action === "close-calculator") {
    state.calculator.isOpen = false;
    state.calculator.targetStepId = null;
    saveState();
    render();
    return;
  }
  if (action === "calc-operator") {
    addCalculatorOperator(target.dataset.operator);
    return;
  }
  if (action === "calc-clear") {
    state.calculator.tokens = [];
    state.calculator.result = null;
    state.calculator.error = null;
    saveState();
    render();
    return;
  }
  if (action === "calc-backspace") {
    state.calculator.tokens = [...(state.calculator.tokens || [])].slice(0, -1);
    state.calculator.result = null;
    state.calculator.error = null;
    saveState();
    render();
    return;
  }
  if (action === "calc-equals") {
    calculateCurrentExpression();
    return;
  }
  if (action === "calc-use-result") {
    useCalculatorResult();
    return;
  }
  if (action === "calc-use-history") {
    state.calculator.result = Number(target.dataset.result);
    state.calculator.error = null;
    saveState();
    render();
    return;
  }
  if (action === "trigger-import") {
    document.querySelector("#deep-import-file")?.click();
    return;
  }
  if (action === "confirm-import") {
    if (!pendingImportPayload) return;
    exportDeepState("before-import");
    state = normalizeImportedState(pendingImportPayload);
    state.onboardingComplete = true;
    pendingImportPayload = null;
    saveState();
    location.hash = "#records";
    render();
    showToast("学習データを読み込みました");
    return;
  }
  if (action === "export-state") {
    exportDeepState("manual");
    return;
  }
  if (action === "finish-case") {
    const current = currentCasePage();
    if (current && getCaseCompletion(current.data).isComplete) {
      state.completedCases[current.data.id] = { completedAt: new Date().toISOString(), score: getCaseScore(current.data) };
      markLearningActivity();
      saveState();
      location.hash = "#records";
    }
    return;
  }
  legacyHandleClick(event);
};

handleInput = function handleDeepInput(event) {
  legacyHandleInput(event);
  const element = event.target;
  if (element.dataset.setting) {
    state.settings[element.dataset.setting] = element.type === "checkbox" ? element.checked : element.value;
    saveState();
    document.body.classList.toggle("reduce-motion", Boolean(state.settings.reducedMotion));
  }
};

function exportDeepState(reason = "manual") {
  const payload = {
    schemaVersion: DEEP_STATE_VERSION,
    exportedAt: new Date().toISOString(),
    reason,
    app: "Accounting Quest",
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `accounting-quest-${reason}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result || ""));
      const validation = validateImportedPayload(payload);
      if (!validation.valid) throw new Error(validation.message);
      pendingImportPayload = validation.data;
      state.ui.modal = "import-confirm";
      state.ui.importError = null;
      saveState();
      render();
    } catch (error) {
      pendingImportPayload = null;
      state.ui.importError = error.message;
      saveState();
      showToast(`読み込めませんでした：${error.message}`);
    }
  });
  reader.readAsText(file);
}

document.addEventListener("change", (event) => {
  if (event.target?.id === "deep-import-file") {
    handleImportFile(event.target.files?.[0]);
    event.target.value = "";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.calculator?.isOpen) {
      state.calculator.isOpen = false;
      saveState();
      render();
      return;
    }
    if (state.ui.modal) {
      state.ui.modal = null;
      saveState();
      render();
      return;
    }
    if (currentView.name === "case") {
      state.ui.modal = "exit-confirm";
      saveState();
      render();
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    const button = document.querySelector('.deep-step [data-action="check-answer"]:not(:disabled)');
    if (button) {
      event.preventDefault();
      button.click();
    }
  }
});

window.addEventListener("online", () => { render(); showToast("オンラインに戻りました"); });
window.addEventListener("offline", () => { render(); });
