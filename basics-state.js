function ensureBasicsState() {
  state.basicsProgress = state.basicsProgress && typeof state.basicsProgress === "object" ? state.basicsProgress : {};
  state.basicsMistakes = Array.isArray(state.basicsMistakes) ? state.basicsMistakes : [];
  state.basicsCourse = {
    lastLessonId: null,
    lastSlideIndex: 0,
    ...(state.basicsCourse || {}),
  };
  state.skillProgress = state.skillProgress && typeof state.skillProgress === "object" ? state.skillProgress : {};
}

ensureBasicsState();

function getBasicLesson(lessonId) {
  return basicsCourse?.lessons?.find((lesson) => lesson.id === lessonId) || basicsCourse?.lessons?.[0] || null;
}

function getBasicLessonProgress(lessonId) {
  ensureBasicsState();
  state.basicsProgress[lessonId] = {
    answers: {},
    attempts: {},
    completedAt: null,
    bestScore: 0,
    lastSlideIndex: 0,
    ...(state.basicsProgress[lessonId] || {}),
  };
  state.basicsProgress[lessonId].answers ||= {};
  state.basicsProgress[lessonId].attempts ||= {};
  return state.basicsProgress[lessonId];
}

function saveBasicAnswer(lesson, question, value, result) {
  const progress = getBasicLessonProgress(lesson.id);
  const attempt = {
    attemptedAt: new Date().toISOString(),
    value: structuredClone(value),
    correct: Boolean(result.correct),
    score: Number(result.score || 0),
    maxScore: Number(result.maxScore || 0),
  };
  progress.attempts[question.id] = [...(progress.attempts[question.id] || []), attempt].slice(-20);
  progress.answers[question.id] = {
    value: structuredClone(value),
    checked: true,
    correct: Boolean(result.correct),
    score: Number(result.score || 0),
    maxScore: Number(result.maxScore || 0),
    feedback: result.feedback,
    checkedAt: attempt.attemptedAt,
  };

  state.basicsMistakes = state.basicsMistakes.filter((item) => item.questionId !== question.id);
  if (!result.correct) {
    state.basicsMistakes.push({
      lessonId: lesson.id,
      questionId: question.id,
      prompt: question.prompt,
      feedback: question.hint,
      createdAt: attempt.attemptedAt,
    });
  }
  markLearningActivity();
  saveState();
}

function completeBasicLesson(lesson) {
  const progress = getBasicLessonProgress(lesson.id);
  if (!isBasicLessonReadyToComplete(lesson, progress)) return false;
  const score = getBasicLessonScorePercent(lesson, progress);
  progress.completedAt = progress.completedAt || new Date().toISOString();
  progress.bestScore = Math.max(Number(progress.bestScore || 0), score);
  progress.lastSlideIndex = getBasicSlideCount(lesson) - 1;
  state.basicsCourse.lastLessonId = lesson.id;
  state.basicsCourse.lastSlideIndex = progress.lastSlideIndex;

  const mastery = getBasicLessonMastery(score);
  for (const skillId of lesson.skillIds || []) {
    const current = state.skillProgress[skillId] || {};
    state.skillProgress[skillId] = {
      ...current,
      mastery: Math.max(Number(current.mastery || 0), mastery),
      mastered: Boolean(current.mastered || mastery >= 100),
      lessonIds: [...new Set([...(current.lessonIds || []), lesson.id])],
      lastPracticedAt: new Date().toISOString(),
      bestFoundationScore: Math.max(Number(current.bestFoundationScore || 0), score),
    };
  }
  markLearningActivity();
  saveState();
  return true;
}

function getBasicsCourseProgress() {
  ensureBasicsState();
  const lessons = basicsCourse?.lessons || [];
  const completed = lessons.filter((lesson) => Boolean(getBasicLessonProgress(lesson.id).completedAt));
  const totalQuestions = lessons.reduce((total, lesson) => total + (lesson.questions?.length || 0), 0);
  const checkedQuestions = lessons.reduce((total, lesson) => {
    const progress = getBasicLessonProgress(lesson.id);
    return total + (lesson.questions || []).filter((question) => progress.answers?.[question.id]?.checked).length;
  }, 0);
  return {
    completedLessons: completed.length,
    totalLessons: lessons.length,
    checkedQuestions,
    totalQuestions,
    percent: totalQuestions ? Math.round((checkedQuestions / totalQuestions) * 100) : 0,
  };
}

function getNextBasicLesson() {
  const lessons = basicsCourse?.lessons || [];
  return lessons.find((lesson) => !getBasicLessonProgress(lesson.id).completedAt) || null;
}

function getBasicReviewItems() {
  ensureBasicsState();
  return [...state.basicsMistakes].reverse().map((item) => {
    const lesson = getBasicLesson(item.lessonId);
    const question = lesson?.questions?.find((entry) => entry.id === item.questionId);
    return {
      ...item,
      lesson,
      question,
      slideIndex: lesson && question ? getBasicQuestionSlideIndex(lesson, question.id) : 0,
    };
  }).filter((item) => item.lesson && item.question);
}

const legacyGetTodayCompletedStepsForBasics = getTodayCompletedSteps;
getTodayCompletedSteps = function getTodayCompletedCaseAndFoundationSteps() {
  const today = toLocalDateKey();
  const foundationCount = Object.values(state.basicsProgress || {}).reduce((total, progress) => {
    return total + Object.values(progress?.answers || {}).filter((answer) => {
      if (!answer?.checkedAt) return false;
      return toLocalDateKey(new Date(answer.checkedAt)) === today;
    }).length;
  }, 0);
  return legacyGetTodayCompletedStepsForBasics() + foundationCount;
};
