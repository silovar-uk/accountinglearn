import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const readJson = async (file) => JSON.parse(await fs.readFile(path.resolve(file), "utf8"));

async function loadRuntime() {
  const source = await fs.readFile(path.resolve("case-schema.js"), "utf8");
  const context = { console, structuredClone };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "case-schema.js" });
  return context;
}

test("published v1 CASE 1 normalizes to the v2 runtime contract without changing stable ids", async () => {
  const runtime = await loadRuntime();
  const raw = await readJson("data/cases/case-001-black-profit-no-cash.json");
  const manifest = await readJson("data/cases/index.json");
  const entry = manifest.cases.find((item) => item.id === raw.id);
  const before = structuredClone(raw);
  const normalized = runtime.normalizeCaseDefinition(raw, entry);

  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.source.schemaVersion, 1);
  assert.equal(normalized.source.migratedAtRuntime, true);
  assert.equal(normalized.id, raw.id);
  assert.deepEqual(normalized.pages.map((page) => page.id), raw.pages.map((page) => page.id));
  assert.deepEqual(normalized.pages.flatMap((page) => page.steps || []).map((step) => step.id), raw.pages.flatMap((page) => page.steps || []).map((step) => step.id));
  assert.equal(normalized.metadata.status, "published");
  assert.equal(normalized.metadata.contentVersion, "1.0.0");
  assert.equal(normalized.metadata.industry, "event-production");
  assert.equal(normalized.pages[0].unlock.type, "always");
  assert.deepEqual(normalized.pages[1].unlock, { type: "page-complete", pageId: normalized.pages[0].id });
  assert.deepEqual(raw, before, "normalization must not mutate the source JSON");
});

test("normalization adds skill links, staged hints, and assessment metadata", async () => {
  const runtime = await loadRuntime();
  const raw = await readJson("data/cases/case-001-black-profit-no-cash.json");
  const manifest = await readJson("data/cases/index.json");
  const normalized = runtime.normalizeCaseDefinition(raw, manifest.cases[0]);
  const formulaStep = normalized.pages.flatMap((page) => page.steps || []).find((step) => step.id === "step-04-01");
  const proposalStep = normalized.pages.flatMap((page) => page.steps || []).find((step) => step.id === "step-07-02");

  assert.ok(normalized.pedagogy.skillIds.includes("accounting.receivables"));
  assert.ok(formulaStep.skillIds.includes("analysis.calculation"));
  assert.ok(formulaStep.hints.length >= 1);
  assert.equal(formulaStep.assessment.mode, "auto");
  assert.equal(formulaStep.assessment.maxPoints, 15);
  assert.equal(proposalStep.assessment.mode, "self-review");
  assert.equal(proposalStep.assessment.maxPoints, 0);
});

test("skill catalog and native v2 fixture satisfy the shared runtime validator", async () => {
  const runtime = await loadRuntime();
  const skills = await readJson("data/skills/index.json");
  const fixture = await readJson("tests/fixtures/case-v2-minimal.json");
  const skillValidation = runtime.validateSkillCatalog(skills);
  const normalized = runtime.normalizeCaseDefinition(fixture, {
    status: fixture.metadata.status,
    releaseOrder: fixture.metadata.releaseOrder,
    contentVersion: fixture.metadata.contentVersion,
    skillIds: fixture.pedagogy.skillIds,
    metadata: {
      difficultyLevel: fixture.metadata.difficulty.level,
      estimatedMinutes: fixture.metadata.estimatedMinutes,
      format: fixture.metadata.format,
      industry: fixture.metadata.industry,
      companyStage: fixture.metadata.companyStage,
      fictional: fixture.metadata.fictional,
      locale: fixture.metadata.locale,
    },
  });
  const validation = runtime.validateCaseDefinition(normalized, skills);

  assert.equal(skillValidation.valid, true, skillValidation.errors.join("\n"));
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(normalized.source.schemaVersion, 2);
  assert.equal(normalized.source.migratedAtRuntime, false);
});

test("v2 validator rejects future-page unlocks, unknown skills, and duplicate hint levels", async () => {
  const runtime = await loadRuntime();
  const skills = await readJson("data/skills/index.json");
  const fixture = await readJson("tests/fixtures/case-v2-minimal.json");
  fixture.pages[1].unlock.pageId = "page-03-ending";
  fixture.pages[1].skillIds.push("analysis.unknown");
  fixture.pages[1].steps[0].hints.push({ level: 1, label: "重複", text: "重複レベル" });
  const validation = runtime.validateCaseDefinition(fixture, skills);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("earlier page")));
  assert.ok(validation.errors.some((error) => error.includes("unknown skill")));
  assert.ok(validation.errors.some((error) => error.includes("duplicate hint level")));
});

test("migration command writes a native v2 case without legacy display aliases", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "accounting-quest-v2-"));
  const output = path.join(directory, "case-v2.json");
  await execFileAsync(process.execPath, [
    "scripts/migrate-case-v2.mjs",
    "data/cases/case-001-black-profit-no-cash.json",
    "--out",
    output,
  ]);
  const migrated = await readJson(output);

  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.source.schemaVersion, 1);
  assert.equal(migrated.source.migratedFromLegacy, true);
  assert.ok(migrated.metadata);
  assert.ok(migrated.pedagogy);
  assert.equal("difficulty" in migrated, false);
  assert.equal("estimatedMinutes" in migrated, false);
  assert.equal("learningObjectives" in migrated, false);
  assert.ok(migrated.pages.every((page) => page.unlock && Number.isInteger(page.estimatedMinutes)));
});

test("schema runtime loads before boot and schema-aware state loads after deep state", async () => {
  const html = await fs.readFile(path.resolve("index.html"), "utf8");
  const schema = html.indexOf("case-schema.js");
  const core = html.indexOf("app-core.js");
  const bootstrap = html.indexOf("case-schema-bootstrap.js");
  const actions = html.indexOf("app-actions.js");
  const deepState = html.indexOf("deep-state.js");
  const schemaState = html.indexOf("case-schema-state.js");
  const deepUi = html.indexOf("deep-ui-shell.js");

  assert.ok(schema >= 0 && schema < core);
  assert.ok(core < bootstrap && bootstrap < actions);
  assert.ok(deepState < schemaState && schemaState < deepUi);
});

test("service worker caches schema runtime and skill catalog with a new cache version", async () => {
  const serviceWorker = await fs.readFile(path.resolve("sw.js"), "utf8");
  assert.match(serviceWorker, /accounting-quest-v5/);
  assert.match(serviceWorker, /\.\/case-schema\.js/);
  assert.match(serviceWorker, /\.\/case-schema-bootstrap\.js/);
  assert.match(serviceWorker, /\.\/case-schema-state\.js/);
  assert.match(serviceWorker, /\.\/data\/skills\/index\.json/);
});
