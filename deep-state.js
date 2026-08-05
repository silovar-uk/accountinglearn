const DEEP_STATE_VERSION = 2;
const DEEP_DEFAULT_SETTINGS = {
  learningMode: "beginner",
  dailyGoal: 1,
  reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false,
  showHintsAfterMistake: true,
  compactNumbers: false,
};

function ensureDeepState() {
  state.dataVersion = Number(state.dataVersion || DEEP_STATE_VERSION);
  state.settings = { ...DEEP_DEFAULT_SETTINGS, ...(state.settings || {}) };
  state.activityDates = Array.isArray(state.activityDates) ? state.activityDates : [];
  state.attemptHistory = state.attemptHistory && typeof state.attemptHistory === "object" ? state.attemptHistory : {};
  state.hintsOpen = state.hintsOpen && typeof state.hintsOpen === "object" ? state.hintsOpen : {};
  state.calculationHistory = Array.isArray(state.calculationHistory) ? state.calculationHistory : [];
  state.calculator = {
    isOpen: false,
    tokens: [],
    result: null,
    error: null,
    targetStepId: null,
    ...(state.calculator || {}),
  };
  state.ui = {
    modal: null,
    saveStatus: "saved",
    lastSavedAt: null,
    importError: null,
    ...(state.ui || {}),
  };
  if (typeof state.onboardingComplete !== "boolean") state.onboardingComplete = false;
  if (!state.selectedLearningMode) state.selectedLearningMode = state.settings.learningMode;
  state.dataVersion = DEEP_STATE_VERSION;
}

ensureDeepState();

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function markLearningActivity() {
  const today = toLocalDateKey();
  if (!state.activityDates.includes(today)) {
    state.activityDates = [...state.activityDates, today].sort();
  }
}

function getLearningStreak() {
  const dates = new Set(state.activityDates || []);
  if (!dates.size) return { current: 0, longest: 0, activeToday: false };
  const sorted = [...dates].sort();
  let longest = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T12:00:00`);
    const current = new Date(`${sorted[index]}T12:00:00`);
    const diff = Math.round((current - previous) / 86400000);
    run = diff === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const activeToday = dates.has(todayKey);
  let cursor = activeToday ? today : yesterday;
  let current = 0;
  while (dates.has(toLocalDateKey(cursor))) {
    current += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, longest, activeToday };
}

function getTodayCompletedSteps() {
  const today = toLocalDateKey();
  return Object.values(state.answers || {}).filter((answer) => {
    if (!answer?.checkedAt) return false;
    return toLocalDateKey(new Date(answer.checkedAt)) === today;
  }).length;
}

function getAttemptHistory(stepId) {
  return Array.isArray(state.attemptHistory?.[stepId]) ? state.attemptHistory[stepId] : [];
}

function registerAttempt(step, value, result) {
  const attempt = {
    attemptedAt: new Date().toISOString(),
    value: structuredClone(value),
    correct: Boolean(result.correct),
    score: Number(result.score || 0),
    maxScore: Number(result.maxScore || 0),
  };
  state.attemptHistory[step.id] = [...getAttemptHistory(step.id), attempt].slice(-20);
}

function getAttemptStats() {
  const attempts = Object.values(state.attemptHistory || {}).flat();
  const firstAttempts = Object.values(state.attemptHistory || {}).map((items) => items?.[0]).filter(Boolean);
  const correctFirst = firstAttempts.filter((item) => item.correct).length;
  return {
    total: attempts.length,
    uniqueSteps: firstAttempts.length,
    firstTryAccuracy: firstAttempts.length ? Math.round((correctFirst / firstAttempts.length) * 100) : 0,
  };
}

function getSmartResumeIndex(data) {
  const firstIncomplete = data.pages.findIndex((page) => !getPageCompletion(data, page).isComplete);
  if (firstIncomplete >= 0) return firstIncomplete;
  if (state.completedCases[data.id]) return data.pages.length - 1;
  return clamp(state.caseProgress[data.id] || 0, 0, data.pages.length - 1);
}

function getPageRequirementLabels(page) {
  const labels = [];
  for (const step of page.steps || []) {
    if (step.type === "proposalBuilder") {
      const values = state.answers[step.id]?.value || {};
      for (const field of (step.fields || []).filter((item) => item.required)) {
        if (!String(values[field.id] || "").trim()) labels.push(`「${field.label}」を入力`);
      }
    } else if (!state.answers[step.id]?.checked) {
      labels.push(`「${step.instruction}」を確認`);
    }
  }
  return labels;
}

function canNavigateToCasePage(data, targetIndex) {
  if (targetIndex <= 0) return true;
  const current = clamp(currentView.pageIndex, 0, data.pages.length - 1);
  if (targetIndex <= current) return true;
  for (let index = 0; index < targetIndex; index += 1) {
    if (!getPageCompletion(data, data.pages[index]).isComplete) return false;
  }
  return true;
}

function getHintForStep(step) {
  if (step.hint) return typeof step.hint === "string" ? step.hint : step.hint.text;
  if (step.type === "formulaBuilder") return `まず「${step.formula?.template || "必要な式"}」に、資料の同じ単位の数字を当てはめます。`;
  if (step.type === "journalEntry") return "現金が動いたか、まだ未入金・未払いかを先に確認し、借方と貸方を決めます。";
  if (step.type === "highlightAnomaly") return "利益だけでなく、現預金がどこへ移ったかを資産項目の前年差から追います。";
  if (step.type === "multipleChoice") return "問題文が求める個数と、経営課題へ直接つながる選択肢を確認します。";
  if (step.type === "singleChoice") return "各選択肢を、資料に書かれた事実と一つずつ照らし合わせます。";
  return "数字、原因、経営への影響の順に整理してみましょう。";
}

function getRemainingMinutes(data, pageIndex) {
  const remainingPages = Math.max(0, data.pages.length - pageIndex - 1);
  const average = Math.max(2, Math.round(Number(data.estimatedMinutes || 24) / Math.max(data.pages.length, 1)));
  return remainingPages * average;
}

function getSaveStatusLabel() {
  if (state.ui.saveStatus === "saving") return "保存中";
  if (!state.ui.lastSavedAt) return "端末内に保存";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(state.ui.lastSavedAt).getTime()) / 1000));
  if (seconds < 10) return "保存済み";
  if (seconds < 60) return `${seconds}秒前に保存`;
  return `${Math.floor(seconds / 60)}分前に保存`;
}

function validateImportedPayload(payload) {
  if (!payload || typeof payload !== "object") return { valid: false, message: "JSONの形式を確認できません。" };
  const imported = payload.data || payload;
  if (!imported.answers || typeof imported.answers !== "object") return { valid: false, message: "回答データが見つかりません。" };
  if (!imported.caseProgress || typeof imported.caseProgress !== "object") return { valid: false, message: "ケース進捗が見つかりません。" };
  return { valid: true, data: imported };
}

function normalizeImportedState(imported) {
  return {
    ...structuredClone(defaultState),
    ...imported,
    settings: { ...DEEP_DEFAULT_SETTINGS, ...(imported.settings || {}) },
    activityDates: Array.isArray(imported.activityDates) ? imported.activityDates : [],
    attemptHistory: imported.attemptHistory || {},
    hintsOpen: {},
    calculator: { isOpen: false, tokens: [], result: null, error: null, targetStepId: null },
    ui: { modal: null, saveStatus: "saved", lastSavedAt: new Date().toISOString(), importError: null },
    dataVersion: DEEP_STATE_VERSION,
  };
}
