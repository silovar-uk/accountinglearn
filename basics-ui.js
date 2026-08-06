function parseBasicsRoute() {
  const raw = location.hash.replace(/^#/, "");
  const [view, lessonId, slideIndex] = raw.split("/");
  if (view !== "basics" || !lessonId) return { name: "library" };
  return { name: "lesson", lessonId, slideIndex: Number(slideIndex || 0) };
}

function renderBasics() {
  ensureBasicsState();
  const route = parseBasicsRoute();
  if (route.name === "lesson") return renderBasicLesson(route.lessonId, route.slideIndex);
  return renderBasicsLibrary();
}

function renderBasicsLibrary() {
  const progress = getBasicsCourseProgress();
  const nextLesson = getNextBasicLesson();
  return `<div class="page-heading"><span class="page-heading-icon">${navIcon("basics",25)}</span><div><p class="eyebrow">FOUNDATIONS</p><h1 class="page-title">ケースにつながる簿記基礎</h1><p class="page-lead">${escapeHtml(basicsCourse.description)}</p></div></div>
    <section class="card basics-overview">
      <div><p class="eyebrow">COURSE PROGRESS</p><h2>${progress.completedLessons} / ${progress.totalLessons} 単元完了</h2><p>${progress.checkedQuestions} / ${progress.totalQuestions} 問を確認済み</p></div>
      <div class="basics-progress-ring" style="--progress:${progress.percent}"><strong>${progress.percent}%</strong></div>
    </section>
    ${nextLesson ? `<section class="card basics-next-card"><div><p class="eyebrow">NEXT STEP</p><h2>${escapeHtml(nextLesson.title)}</h2><p>${escapeHtml(nextLesson.summary)}</p></div><button class="btn btn-primary" data-action="basics-start" data-lesson-id="${nextLesson.id}">${getBasicLessonProgress(nextLesson.id).lastSlideIndex ? "続きから" : "この単元を始める"}</button></section>` : ""}
    <div class="foundation-list basics-course-list">${(basicsCourse.lessons || []).map((lesson) => renderBasicLessonCard(lesson)).join("")}</div>
    <section class="card basics-connection-card">
      <p class="eyebrow">CASE CONNECTION</p>
      <h2>基礎で終わらせず、CASE 1で使う</h2>
      <p>各単元の最後から、対応するCASE 1のページへ直接戻れます。知識を読んだ直後に、経営判断の文脈で使います。</p>
    </section>`;
}

function renderBasicLessonCard(lesson) {
  const progress = getBasicLessonProgress(lesson.id);
  const checked = (lesson.questions || []).filter((question) => progress.answers?.[question.id]?.checked).length;
  const score = getBasicLessonScorePercent(lesson, progress);
  const complete = Boolean(progress.completedAt);
  const status = complete ? "COMPLETED" : checked ? "IN PROGRESS" : "AVAILABLE";
  return `<article class="card foundation-card basics-lesson-card ${complete ? "complete" : checked ? "in-progress" : ""}">
    <span class="foundation-icon">${navIcon(complete ? "check" : lesson.order % 2 ? "document" : "calculator",23)}</span>
    <div class="basics-lesson-copy">
      <div class="basics-lesson-status"><small>LESSON ${String(lesson.order).padStart(2,"0")} · ${status}</small><span>約${lesson.estimatedMinutes}分</span></div>
      <h2>${escapeHtml(lesson.title)}</h2>
      <p>${escapeHtml(lesson.summary)}</p>
      <div class="basics-skill-chips">${(lesson.skillIds || []).map((skillId) => `<span>${escapeHtml(getSkillTitle(skillId))}</span>`).join("")}</div>
      ${checked ? `<div class="mini-progress"><i style="width:${Math.round((checked / lesson.questions.length) * 100)}%"></i></div><small>${checked}/${lesson.questions.length}問 · ${score}%</small>` : ""}
    </div>
    <button class="case-open-button" data-action="basics-start" data-lesson-id="${lesson.id}" aria-label="${escapeHtml(lesson.title)}を開く">${navIcon(complete ? "check" : "arrowRight",21)}</button>
  </article>`;
}

function renderBasicLesson(lessonId, rawSlideIndex) {
  const lesson = getBasicLesson(lessonId);
  if (!lesson) {
    location.hash = "#basics";
    return "";
  }
  const progress = getBasicLessonProgress(lesson.id);
  const slideCount = getBasicSlideCount(lesson);
  const slideIndex = clamp(rawSlideIndex, 0, slideCount - 1);
  progress.lastSlideIndex = Math.max(Number(progress.lastSlideIndex || 0), slideIndex);
  state.basicsCourse.lastLessonId = lesson.id;
  state.basicsCourse.lastSlideIndex = slideIndex;
  saveState();

  const question = getBasicQuestionFromSlide(lesson, slideIndex);
  const isIntro = slideIndex === 0;
  const isSummary = slideIndex === slideCount - 1;
  const progressPercent = Math.round(((slideIndex + 1) / slideCount) * 100);

  return `<section class="basics-lesson-shell">
    <header class="basics-lesson-header">
      <button class="icon-button" data-action="basics-exit" aria-label="基礎コース一覧へ戻る">${navIcon("arrowLeft",20)}</button>
      <div><p class="eyebrow">LESSON ${String(lesson.order).padStart(2,"0")}</p><h1>${escapeHtml(lesson.shortTitle)}</h1></div>
      <span>${slideIndex + 1}/${slideCount}</span>
    </header>
    <div class="deep-progress-track" role="progressbar" aria-label="単元の進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}"><i style="width:${progressPercent}%"></i></div>
    ${isIntro ? renderBasicLessonIntro(lesson) : isSummary ? renderBasicLessonSummary(lesson, progress) : renderBasicQuestion(lesson, question, slideIndex)}
  </section>`;
}

function renderBasicLessonIntro(lesson) {
  return `<div class="basics-slide">
    <section class="card basics-intro-card">
      <p class="eyebrow">WHY IT MATTERS</p>
      <h1 class="page-title">${escapeHtml(lesson.title)}</h1>
      <p class="page-lead">${escapeHtml(lesson.summary)}</p>
      <div class="basics-concept-list">${lesson.concepts.map((concept, index) => `<article><span>${index + 1}</span><div><h2>${escapeHtml(concept.title)}</h2><p>${escapeHtml(concept.body)}</p></div></article>`).join("")}</div>
    </section>
    <nav class="basics-slide-nav"><button class="btn btn-ghost" data-action="basics-exit">一覧へ</button><button class="btn btn-primary" data-action="basics-go" data-lesson-id="${lesson.id}" data-slide="1">問題へ進む</button></nav>
  </div>`;
}

function renderBasicQuestion(lesson, question, slideIndex) {
  const progress = getBasicLessonProgress(lesson.id);
  const answer = progress.answers?.[question.id] || {};
  return `<div class="basics-slide">
    <section class="card basics-question-card" data-basic-question-id="${question.id}">
      <div class="basics-question-meta"><span>QUESTION ${slideIndex}</span><span>${question.points}点</span></div>
      <h1>${escapeHtml(question.prompt)}</h1>
      ${renderBasicQuestionInput(question, answer)}
      ${answer.checked ? `<div class="feedback ${answer.correct ? "success" : "error"}"><strong>${answer.correct ? "正解です" : "もう一度整理しましょう"}</strong><p>${escapeHtml(answer.correct ? question.explanation : question.hint)}</p>${!answer.correct ? `<details><summary>解説を見る</summary><p>${escapeHtml(question.explanation)}</p></details>` : ""}</div>` : ""}
    </section>
    <nav class="basics-slide-nav">
      <button class="btn btn-ghost" data-action="basics-go" data-lesson-id="${lesson.id}" data-slide="${slideIndex - 1}">前へ</button>
      ${answer.checked
        ? `<button class="btn btn-primary" data-action="basics-go" data-lesson-id="${lesson.id}" data-slide="${slideIndex + 1}">次へ</button>`
        : `<button class="btn btn-primary" data-action="basics-check" data-lesson-id="${lesson.id}" data-question-id="${question.id}" ${isBasicAnswerReady(question, answer) ? "" : "disabled"}>答えを確認</button>`}
    </nav>
  </div>`;
}

function renderBasicQuestionInput(question, answer) {
  if (question.type === "numberInput") {
    return `<div class="field basics-number-field"><label for="basic-${question.id}">回答（${escapeHtml(question.unit)}）</label><input id="basic-${question.id}" type="number" inputmode="decimal" step="any" data-basics-number="${question.id}" value="${answer.value ?? ""}" placeholder="数値を入力" /></div>`;
  }
  const multiple = question.type === "multipleChoice";
  const selected = new Set(multiple ? answer.value || [] : [answer.value]);
  return `<div class="option-grid basics-option-grid">${question.options.map((option) => {
    const active = selected.has(option.id);
    const correct = multiple ? question.correctOptionIds?.includes(option.id) : question.correctOptionId === option.id;
    const stateClass = answer.checked ? correct ? "correct" : active ? "incorrect" : "" : "";
    return `<button class="option ${active ? "selected" : ""} ${stateClass}" data-action="basics-select" data-lesson-id="${getLessonIdForQuestion(question.id)}" data-question-id="${question.id}" data-option-id="${option.id}" data-multiple="${multiple}">${escapeHtml(option.label)}</button>`;
  }).join("")}</div>`;
}

function renderBasicLessonSummary(lesson, progress) {
  const ready = isBasicLessonReadyToComplete(lesson, progress);
  const score = getBasicLessonScorePercent(lesson, progress);
  const complete = Boolean(progress.completedAt);
  return `<div class="basics-slide">
    <section class="card basics-summary-card">
      <p class="eyebrow">LESSON REVIEW</p>
      <div class="basics-summary-score"><strong>${score}%</strong><span>${complete ? "習得記録済み" : ready ? "完了できます" : "未回答があります"}</span></div>
      <h1>${escapeHtml(lesson.title)}</h1>
      <ul class="mission-list">${lesson.takeaways.map((item) => `<li><span>${navIcon("check",16)}</span>${escapeHtml(item)}</li>`).join("")}</ul>
      <div class="basics-skill-result">${lesson.skillIds.map((skillId) => `<span><strong>${escapeHtml(getSkillTitle(skillId))}</strong><small>${score >= 80 ? "習得" : score >= 60 ? "要復習" : "練習中"}</small></span>`).join("")}</div>
      ${lesson.caseLinks?.length ? `<div class="basics-case-links"><p class="eyebrow">USE IT IN A CASE</p>${lesson.caseLinks.map((link) => `<button class="btn btn-ghost btn-block" data-action="basics-open-case" data-case-id="${link.caseId}" data-page-id="${link.pageId}">${escapeHtml(link.label)} ${navIcon("arrowRight",16)}</button>`).join("")}</div>` : ""}
    </section>
    <nav class="basics-slide-nav">
      <button class="btn btn-ghost" data-action="basics-go" data-lesson-id="${lesson.id}" data-slide="${getBasicSlideCount(lesson) - 2}">前へ</button>
      <button class="btn btn-primary" data-action="basics-finish" data-lesson-id="${lesson.id}" ${ready ? "" : "disabled"}>${complete ? "一覧へ戻る" : "単元を完了"}</button>
    </nav>
  </div>`;
}

function getLessonIdForQuestion(questionId) {
  return basicsCourse?.lessons?.find((lesson) => lesson.questions?.some((question) => question.id === questionId))?.id || "";
}

function getSkillTitle(skillId) {
  return skillCatalog?.skills?.find((skill) => skill.id === skillId)?.title || skillId;
}

function isBasicAnswerReady(question, answer) {
  if (question.type === "numberInput") return answer.value !== "" && answer.value !== undefined && Number.isFinite(Number(answer.value));
  if (question.type === "multipleChoice") return Array.isArray(answer.value) && answer.value.length > 0;
  return Boolean(answer.value);
}

const legacyRenderReviewForBasics = renderReview;
renderReview = function renderReviewWithFoundations() {
  const basicsItems = getBasicReviewItems();
  if (!basicsItems.length) return legacyRenderReviewForBasics();
  const basicsSection = `<section class="basics-review-section"><div class="section-head"><h2>基礎の復習</h2><small>${basicsItems.length}問</small></div><div class="review-list">${basicsItems.map((item,index) => `<article class="card review-card"><span class="review-index">${String(index + 1).padStart(2,"0")}</span><div><small>${escapeHtml(item.lesson.shortTitle)}</small><h2>${escapeHtml(item.question.prompt)}</h2><p>${escapeHtml(item.feedback)}</p><button class="text-action" data-action="basics-review" data-lesson-id="${item.lesson.id}" data-slide="${item.slideIndex}">この問題を復習 ${navIcon("arrowRight",17)}</button></div></article>`).join("")}</div></section>`;
  if (state.mistakes.length) return `${legacyRenderReviewForBasics()}${basicsSection}`;
  return `<div class="page-heading"><span class="page-heading-icon">${navIcon("review",25)}</span><div><p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1><p class="page-lead">間違えた基礎問題を、別の日にもう一度。</p></div></div>${basicsSection}`;
};

const legacyRenderRecordsForBasics = renderRecords;
renderRecords = function renderRecordsWithFoundations() {
  const original = legacyRenderRecordsForBasics();
  const progress = getBasicsCourseProgress();
  const masteredSkills = Object.values(state.skillProgress || {}).filter((item) => item.mastered).length;
  return `${original}<section class="card basics-record-card"><p class="eyebrow">FOUNDATIONS</p><h2>基礎コース</h2><div class="stat-grid"><div class="stat-card"><strong>${progress.completedLessons}</strong><span>単元完了</span></div><div class="stat-card"><strong>${progress.checkedQuestions}</strong><span>問題確認</span></div><div class="stat-card"><strong>${masteredSkills}</strong><span>技能習得</span></div><div class="stat-card"><strong>${progress.percent}%</strong><span>進捗</span></div></div><button class="btn btn-ghost btn-block" data-action="navigate" data-target="basics">基礎コースを見る</button></section>`;
};
