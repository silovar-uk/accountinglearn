const legacyHandleClickForBasics = handleClick;
handleClick = function handleFoundationsClick(event) {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  if (!target || !action?.startsWith("basics-")) {
    legacyHandleClickForBasics(event);
    return;
  }

  ensureBasicsState();

  if (action === "basics-start") {
    const lesson = getBasicLesson(target.dataset.lessonId);
    if (!lesson) return;
    const progress = getBasicLessonProgress(lesson.id);
    const last = clamp(Number(progress.lastSlideIndex || 0), 0, getBasicSlideCount(lesson) - 1);
    location.hash = `#basics/${lesson.id}/${last}`;
    return;
  }

  if (action === "basics-go" || action === "basics-review") {
    const lesson = getBasicLesson(target.dataset.lessonId);
    if (!lesson) return;
    const slide = clamp(Number(target.dataset.slide || 0), 0, getBasicSlideCount(lesson) - 1);
    getBasicLessonProgress(lesson.id).lastSlideIndex = slide;
    saveState();
    location.hash = `#basics/${lesson.id}/${slide}`;
    return;
  }

  if (action === "basics-exit") {
    location.hash = "#basics";
    return;
  }

  if (action === "basics-select") {
    const lesson = getBasicLesson(target.dataset.lessonId);
    const question = lesson?.questions?.find((item) => item.id === target.dataset.questionId);
    if (!lesson || !question) return;
    const progress = getBasicLessonProgress(lesson.id);
    const answer = progress.answers[question.id] || {};
    if (target.dataset.multiple === "true") {
      const selected = new Set(Array.isArray(answer.value) ? answer.value : []);
      selected.has(target.dataset.optionId) ? selected.delete(target.dataset.optionId) : selected.add(target.dataset.optionId);
      answer.value = [...selected];
    } else {
      answer.value = target.dataset.optionId;
    }
    answer.checked = false;
    progress.answers[question.id] = answer;
    saveState();
    render();
    return;
  }

  if (action === "basics-check") {
    const lesson = getBasicLesson(target.dataset.lessonId);
    const question = lesson?.questions?.find((item) => item.id === target.dataset.questionId);
    if (!lesson || !question) return;
    const progress = getBasicLessonProgress(lesson.id);
    const answer = progress.answers[question.id] || {};
    if (!isBasicAnswerReady(question, answer)) return;
    const result = gradeBasicQuestion(question, answer.value);
    saveBasicAnswer(lesson, question, answer.value, result);
    render();
    if (typeof announceDeep === "function") announceDeep(result.correct ? "正解です" : "復習候補へ追加しました");
    return;
  }

  if (action === "basics-finish") {
    const lesson = getBasicLesson(target.dataset.lessonId);
    if (!lesson) return;
    const progress = getBasicLessonProgress(lesson.id);
    if (!progress.completedAt) {
      if (!completeBasicLesson(lesson)) return;
      showToast("単元を完了し、技能の習得度を更新しました");
    }
    location.hash = "#basics";
    return;
  }

  if (action === "basics-open-case") {
    const data = getCase(target.dataset.caseId);
    const pageIndex = data.pages.findIndex((page) => page.id === target.dataset.pageId);
    if (pageIndex >= 0) openCase(data.id, pageIndex);
  }
};

const legacyHandleInputForBasics = handleInput;
handleInput = function handleFoundationsInput(event) {
  legacyHandleInputForBasics(event);
  const element = event.target;
  if (!element.dataset.basicsNumber) return;
  ensureBasicsState();
  const questionId = element.dataset.basicsNumber;
  const lesson = basicsCourse?.lessons?.find((item) => item.questions?.some((question) => question.id === questionId));
  const question = lesson?.questions?.find((item) => item.id === questionId);
  if (!lesson || !question) return;
  const progress = getBasicLessonProgress(lesson.id);
  const answer = progress.answers[questionId] || {};
  answer.value = element.value === "" ? "" : Number(element.value);
  answer.checked = false;
  progress.answers[questionId] = answer;
  saveState();
  updateBasicCheckButton(lesson, question, answer);
};

function updateBasicCheckButton(lesson, question, answer) {
  const card = document.querySelector(`[data-basic-question-id="${question.id}"]`);
  const button = card?.parentElement?.querySelector('[data-action="basics-check"]');
  if (button) button.disabled = !isBasicAnswerReady(question, answer);
}
