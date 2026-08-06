import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = (file) => fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
const loadCase = async () => JSON.parse(await read("data/cases/case-001-black-profit-no-cash.json"));

function financialRows(data) {
  return (data.documents || []).flatMap((document) => [
    ...(document.rows || []),
    ...(document.sections || []).flatMap((section) => section.rows || []),
  ]);
}

test("manifest id exactly matches the published case id", async () => {
  const manifest = JSON.parse(await read("data/cases/index.json"));
  const data = await loadCase();
  assert.equal(manifest.cases[0].id, data.id);
  assert.equal(manifest.cases[0].releaseOrder, data.releaseOrder);
});

test("formula helper resolves CASE 1 formulas from JSON instead of step-specific constants", async () => {
  const source = await read("case-engine.js");
  const data = await loadCase();
  const context = {
    catalog: [{ data }],
    formatNumber: (value) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value),
    findFinancialRow: (caseData, id) => financialRows(caseData).find((row) => row.id === id),
    formulaHelper: () => null,
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const receivables = context.resolveFormulaHelper("step-04-01");
  assert.ok(Math.abs(receivables.value - 91.25) < 0.001);
  assert.match(receivables.expression, /2,600/);
  assert.match(receivables.expression, /10,400/);

  const cashForecast = context.resolveFormulaHelper("step-06-01");
  assert.equal(cashForecast.value, -200);
  assert.match(cashForecast.expression, /620/);
  assert.doesNotMatch(source, /if \(stepId === "step-04-01"\)/);
  assert.doesNotMatch(source, /if \(stepId === "step-06-01"\)/);
});

test("case engine loads before app-actions starts boot", async () => {
  const html = await read("index.html");
  const engine = html.indexOf("case-engine.js");
  const actions = html.indexOf("app-actions.js");
  assert.ok(engine >= 0);
  assert.ok(actions > engine);
});

test("service worker includes the case engine and uses a new cache version", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /accounting-quest-v4/);
  assert.match(sw, /\.\/case-engine\.js/);
});

test("first-time learners start from the briefing before smart resume", async () => {
  const source = await read("deep-ui-home-case.js");
  assert.match(source, /const started = Boolean\(state\.visitedPages\[featured\.id\]\?\.length\)/);
  assert.match(source, /const resumeIndex = started \? getSmartResumeIndex\(featured\) : 0/);
});
