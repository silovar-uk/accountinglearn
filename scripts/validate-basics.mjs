import fs from "node:fs/promises";
import path from "node:path";

const coursePath = path.resolve(process.cwd(), process.argv[2] || "data/basics/index.json");
const [course, skills, caseManifest] = await Promise.all([
  fs.readFile(coursePath, "utf8").then(JSON.parse),
  fs.readFile(path.resolve("data/skills/index.json"), "utf8").then(JSON.parse),
  fs.readFile(path.resolve("data/cases/index.json"), "utf8").then(JSON.parse),
]);

const errors = [];
const warnings = [];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedQuestionTypes = new Set(["singleChoice", "multipleChoice", "numberInput"]);
const skillIds = new Set((skills.skills || []).map((skill) => skill.id));
const caseMap = new Map();

for (const entry of caseManifest.cases || []) {
  try {
    const data = JSON.parse(await fs.readFile(path.resolve(entry.path), "utf8"));
    caseMap.set(data.id, data);
  } catch (error) {
    errors.push(`cannot read linked case ${entry.id}: ${error.message}`);
  }
}

if (course.schemaVersion !== 1) errors.push("basics schemaVersion must be 1");
if (!idPattern.test(course.courseId || "")) errors.push("courseId must use kebab-case");
if (!course.title || !course.description) errors.push("course title and description are required");
if (!Array.isArray(course.lessons) || !course.lessons.length) errors.push("lessons must not be empty");

const lessonIds = new Set();
const lessonOrders = new Set();
const questionIds = new Set();
let totalMinutes = 0;
let totalQuestions = 0;

for (const lesson of course.lessons || []) {
  const label = lesson.id || `lesson-${lesson.order}`;
  if (!idPattern.test(lesson.id || "")) errors.push(`invalid lesson id: ${lesson.id}`);
  if (lessonIds.has(lesson.id)) errors.push(`duplicate lesson id: ${lesson.id}`);
  lessonIds.add(lesson.id);
  if (!Number.isInteger(lesson.order) || lesson.order < 1) errors.push(`${label}.order must be a positive integer`);
  if (lessonOrders.has(lesson.order)) errors.push(`duplicate lesson order: ${lesson.order}`);
  lessonOrders.add(lesson.order);
  if (!lesson.title || !lesson.shortTitle || !lesson.summary) errors.push(`${label} is missing display metadata`);
  if (!Number.isInteger(lesson.estimatedMinutes) || lesson.estimatedMinutes < 3) errors.push(`${label}.estimatedMinutes must be at least 3`);
  totalMinutes += Number(lesson.estimatedMinutes || 0);

  if (!Array.isArray(lesson.skillIds) || !lesson.skillIds.length) errors.push(`${label}.skillIds must not be empty`);
  for (const skillId of lesson.skillIds || []) if (!skillIds.has(skillId)) errors.push(`${label} uses unknown skill: ${skillId}`);
  for (const prerequisiteId of lesson.recommendedPrerequisiteLessonIds || []) {
    if (!lessonIds.has(prerequisiteId)) errors.push(`${label} prerequisite must refer to an earlier lesson: ${prerequisiteId}`);
  }

  if (!Array.isArray(lesson.concepts) || lesson.concepts.length < 2) errors.push(`${label} needs at least two concepts`);
  for (const concept of lesson.concepts || []) if (!concept.title || !concept.body) errors.push(`${label} has an incomplete concept`);
  if (!Array.isArray(lesson.takeaways) || lesson.takeaways.length < 2) errors.push(`${label} needs at least two takeaways`);

  if (!Array.isArray(lesson.questions) || lesson.questions.length < 4 || lesson.questions.length > 10) {
    errors.push(`${label} must contain 4 to 10 questions`);
  }
  totalQuestions += lesson.questions?.length || 0;

  for (const question of lesson.questions || []) {
    if (!idPattern.test(question.id || "")) errors.push(`invalid question id: ${question.id}`);
    if (questionIds.has(question.id)) errors.push(`duplicate question id: ${question.id}`);
    questionIds.add(question.id);
    if (!allowedQuestionTypes.has(question.type)) errors.push(`${question.id} uses unsupported type: ${question.type}`);
    if (!question.prompt || !question.hint || !question.explanation) errors.push(`${question.id} needs prompt, hint, and explanation`);
    if (!Number.isFinite(Number(question.points)) || Number(question.points) <= 0) errors.push(`${question.id}.points must be positive`);

    if (question.type === "singleChoice" || question.type === "multipleChoice") {
      const optionIds = new Set();
      if (!Array.isArray(question.options) || question.options.length < 2) errors.push(`${question.id} needs at least two options`);
      for (const option of question.options || []) {
        if (!idPattern.test(option.id || "")) errors.push(`${question.id} has invalid option id: ${option.id}`);
        if (optionIds.has(option.id)) errors.push(`${question.id} has duplicate option id: ${option.id}`);
        optionIds.add(option.id);
        if (!option.label) errors.push(`${question.id}.${option.id} needs a label`);
      }
      if (question.type === "singleChoice" && !optionIds.has(question.correctOptionId)) errors.push(`${question.id} correctOptionId is unknown`);
      if (question.type === "multipleChoice") {
        if (!Array.isArray(question.correctOptionIds) || question.correctOptionIds.length < 2) errors.push(`${question.id} needs at least two correct options`);
        for (const correctId of question.correctOptionIds || []) if (!optionIds.has(correctId)) errors.push(`${question.id} correct option is unknown: ${correctId}`);
      }
    }

    if (question.type === "numberInput") {
      if (!Number.isFinite(Number(question.expectedValue))) errors.push(`${question.id}.expectedValue must be numeric`);
      if (!question.unit) errors.push(`${question.id}.unit is required`);
    }
  }

  for (const link of lesson.caseLinks || []) {
    const linkedCase = caseMap.get(link.caseId);
    if (!linkedCase) {
      errors.push(`${label} links to unknown case: ${link.caseId}`);
      continue;
    }
    if (!(linkedCase.pages || []).some((page) => page.id === link.pageId)) errors.push(`${label} links to unknown page: ${link.pageId}`);
    if (!link.label) errors.push(`${label} case link needs a label`);
  }
}

const orders = [...lessonOrders].sort((a, b) => a - b);
for (let index = 0; index < orders.length; index += 1) {
  if (orders[index] !== index + 1) errors.push(`lesson order must be sequential from 1; found ${orders.join(", ")}`);
}
if (Number(course.estimatedMinutes) !== totalMinutes) errors.push(`course estimatedMinutes ${course.estimatedMinutes} does not equal lesson total ${totalMinutes}`);
if (totalQuestions < 20) warnings.push(`course has only ${totalQuestions} questions`);

if (warnings.length) console.warn(warnings.map((warning) => `WARN: ${warning}`).join("\n"));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${course.courseId} / ${course.lessons.length} lessons / ${totalQuestions} questions / ${totalMinutes} minutes`);
