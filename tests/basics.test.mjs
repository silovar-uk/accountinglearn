import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const readJson = async (file) => JSON.parse(await fs.readFile(path.resolve(file), "utf8"));

async function loadEngine() {
  const source = await fs.readFile(path.resolve("basics-engine.js"), "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "basics-engine.js" });
  return context;
}

test("foundations course contains six lessons and twenty-four questions", async () => {
  const course = await readJson("data/basics/index.json");
  assert.equal(course.lessons.length, 6);
  assert.equal(course.lessons.reduce((total, lesson) => total + lesson.questions.length, 0), 24);
  assert.equal(course.estimatedMinutes, 50);
  assert.deepEqual(course.lessons.map((lesson) => lesson.order), [1, 2, 3, 4, 5, 6]);
});

test("every foundation skill and case link resolves", async () => {
  const [course, skills, caseManifest] = await Promise.all([
    readJson("data/basics/index.json"),
    readJson("data/skills/index.json"),
    readJson("data/cases/index.json"),
  ]);
  const skillIds = new Set(skills.skills.map((skill) => skill.id));
  const cases = new Map();
  for (const entry of caseManifest.cases) cases.set(entry.id, await readJson(entry.path));

  for (const lesson of course.lessons) {
    for (const skillId of lesson.skillIds) assert.ok(skillIds.has(skillId), `${lesson.id}: ${skillId}`);
    for (const link of lesson.caseLinks) {
      assert.ok(cases.has(link.caseId), `${lesson.id}: ${link.caseId}`);
      assert.ok(cases.get(link.caseId).pages.some((page) => page.id === link.pageId), `${lesson.id}: ${link.pageId}`);
    }
  }
});

test("single choice and numeric questions grade correctly", async () => {
  const [engine, course] = await Promise.all([loadEngine(), readJson("data/basics/index.json")]);
  const lesson = course.lessons[0];
  const choice = lesson.questions[0];
  const numeric = lesson.questions[1];

  assert.equal(engine.gradeBasicQuestion(choice, "completion").correct, true);
  assert.equal(engine.gradeBasicQuestion(choice, "collection").score, 0);
  assert.equal(engine.gradeBasicQuestion(numeric, 30).correct, true);
  assert.equal(engine.gradeBasicQuestion(numeric, 29).correct, false);
});

test("multiple choice requires the exact set and gives bounded partial credit", async () => {
  const [engine, course] = await Promise.all([loadEngine(), readJson("data/basics/index.json")]);
  const question = course.lessons[0].questions[3];
  const exact = engine.gradeBasicQuestion(question, ["revenue-up", "ar-up"]);
  const partial = engine.gradeBasicQuestion(question, ["revenue-up"]);
  const mixed = engine.gradeBasicQuestion(question, ["revenue-up", "cash-up"]);

  assert.equal(exact.correct, true);
  assert.equal(exact.score, 10);
  assert.equal(partial.correct, false);
  assert.ok(partial.score > 0 && partial.score < 10);
  assert.ok(mixed.score >= 0 && mixed.score <= 10);
});

test("lesson completion and mastery thresholds are stable", async () => {
  const [engine, course] = await Promise.all([loadEngine(), readJson("data/basics/index.json")]);
  const lesson = course.lessons[0];
  const answers = Object.fromEntries(lesson.questions.map((question) => [question.id, { checked: true, score: 10 }]));
  const progress = { answers };

  assert.equal(engine.isBasicLessonReadyToComplete(lesson, progress), true);
  assert.equal(engine.getBasicLessonScorePercent(lesson, progress), 100);
  assert.equal(engine.getBasicLessonMastery(100), 100);
  assert.equal(engine.getBasicLessonMastery(70), 75);
  assert.equal(engine.getBasicLessonMastery(40), 50);
});

test("foundation runtime files load in dependency order", async () => {
  const html = await fs.readFile(path.resolve("index.html"), "utf8");
  const engine = html.indexOf("basics-engine.js");
  const bootstrap = html.indexOf("basics-bootstrap.js");
  const actions = html.indexOf("app-actions.js");
  const deepState = html.indexOf("deep-state.js");
  const basicsState = html.indexOf("basics-state.js");
  const basicsUi = html.indexOf("basics-ui.js");
  const deepActions = html.indexOf("deep-actions.js");
  const basicsActions = html.indexOf("basics-actions.js");

  assert.ok(engine >= 0 && engine < bootstrap);
  assert.ok(bootstrap < actions);
  assert.ok(deepState < basicsState);
  assert.ok(deepActions < basicsUi && basicsUi < basicsActions);
});

test("service worker caches the foundations runtime and content", async () => {
  const serviceWorker = await fs.readFile(path.resolve("sw.js"), "utf8");
  assert.match(serviceWorker, /accounting-quest-v\d+/);
  for (const asset of [
    "./basics-engine.js",
    "./basics-bootstrap.js",
    "./basics-state.js",
    "./basics-ui.js",
    "./basics-actions.js",
    "./basics.css",
    "./data/basics/index.json",
  ]) {
    assert.ok(serviceWorker.includes(`"${asset}"`), asset);
  }
});
