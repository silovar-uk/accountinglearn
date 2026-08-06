function sameBasicSet(left = [], right = []) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function gradeBasicQuestion(question, value) {
  const maxScore = Number(question.points || 0);
  if (question.type === "singleChoice") {
    const correct = value === question.correctOptionId;
    return {
      correct,
      score: correct ? maxScore : 0,
      maxScore,
      feedback: correct ? question.explanation : question.hint,
    };
  }

  if (question.type === "multipleChoice") {
    const selected = Array.isArray(value) ? value : [];
    const correct = sameBasicSet(selected, question.correctOptionIds || []);
    const correctSelections = selected.filter((id) => question.correctOptionIds?.includes(id)).length;
    const incorrectSelections = selected.filter((id) => !question.correctOptionIds?.includes(id)).length;
    const perCorrect = maxScore / Math.max(question.correctOptionIds?.length || 1, 1);
    const score = Math.max(0, Math.min(maxScore, Math.round(correctSelections * perCorrect - incorrectSelections * perCorrect)));
    return {
      correct,
      score,
      maxScore,
      feedback: correct ? question.explanation : question.hint,
    };
  }

  if (question.type === "numberInput") {
    const numeric = Number(value);
    const expected = Number(question.expectedValue);
    const tolerance = Number(question.tolerance || 0);
    const correct = Number.isFinite(numeric) && Math.abs(numeric - expected) <= tolerance;
    return {
      correct,
      score: correct ? maxScore : 0,
      maxScore,
      feedback: correct ? question.explanation : question.hint,
    };
  }

  return {
    correct: false,
    score: 0,
    maxScore,
    feedback: "この問題形式はまだ採点できません。",
  };
}

function getBasicLessonMaxScore(lesson) {
  return (lesson.questions || []).reduce((total, question) => total + Number(question.points || 0), 0);
}

function getBasicLessonEarnedScore(lesson, progress) {
  return (lesson.questions || []).reduce((total, question) => {
    const answer = progress?.answers?.[question.id];
    return total + Number(answer?.score || 0);
  }, 0);
}

function getBasicLessonScorePercent(lesson, progress) {
  const max = getBasicLessonMaxScore(lesson);
  if (!max) return 0;
  return Math.round((getBasicLessonEarnedScore(lesson, progress) / max) * 100);
}

function isBasicLessonReadyToComplete(lesson, progress) {
  return (lesson.questions || []).every((question) => Boolean(progress?.answers?.[question.id]?.checked));
}

function getBasicSlideCount(lesson) {
  return (lesson.questions || []).length + 2;
}

function getBasicQuestionFromSlide(lesson, slideIndex) {
  const questionIndex = Number(slideIndex) - 1;
  return lesson.questions?.[questionIndex] || null;
}

function getBasicQuestionSlideIndex(lesson, questionId) {
  const questionIndex = (lesson.questions || []).findIndex((question) => question.id === questionId);
  return questionIndex >= 0 ? questionIndex + 1 : 0;
}

function getBasicLessonMastery(scorePercent) {
  if (scorePercent >= 80) return 100;
  if (scorePercent >= 60) return 75;
  if (scorePercent > 0) return 50;
  return 0;
}
