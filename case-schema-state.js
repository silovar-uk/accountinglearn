const legacyEnsureDeepStateForSchema = ensureDeepState;

ensureDeepState = function ensureSchemaAwareState() {
  legacyEnsureDeepStateForSchema();
  state.skillProgress = state.skillProgress && typeof state.skillProgress === "object" ? state.skillProgress : {};
};

ensureDeepState();

function isSkillMastered(skillId) {
  const progress = state.skillProgress?.[skillId];
  return Boolean(progress?.mastered || Number(progress?.mastery || 0) >= 100);
}

canNavigateToCasePage = function canNavigateWithSchemaUnlock(data, targetIndex) {
  if (targetIndex < 0 || targetIndex >= data.pages.length) return false;
  const current = clamp(currentView.pageIndex, 0, data.pages.length - 1);
  if (targetIndex <= current) return true;
  const target = data.pages[targetIndex];
  const unlock = target.unlock || { type: targetIndex === 0 ? "always" : "all-previous-complete" };

  if (unlock.type === "always") return true;
  if (unlock.type === "page-complete") {
    const requiredPage = data.pages.find((page) => page.id === unlock.pageId);
    return Boolean(requiredPage && getPageCompletion(data, requiredPage).isComplete);
  }
  if (unlock.type === "all-previous-complete") {
    return data.pages.slice(0, targetIndex).every((page) => getPageCompletion(data, page).isComplete);
  }
  if (unlock.type === "skill-mastered") return isSkillMastered(unlock.skillId);
  return false;
};

getHintForStep = function getSchemaHintForStep(step, level = 1) {
  const hints = Array.isArray(step.hints) ? step.hints : [];
  if (hints.length) {
    const requested = hints.find((hint) => Number(hint.level) === Number(level));
    return (requested || hints[0]).text;
  }
  if (step.hint) return typeof step.hint === "string" ? step.hint : step.hint.text;
  return "数字、原因、経営への影響の順に整理してみましょう。";
};
