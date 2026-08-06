import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const readJson = async (file) => JSON.parse(await fs.readFile(path.resolve(file), "utf8"));

async function loadSchemaRuntime() {
  const source = await fs.readFile(path.resolve("case-schema.js"), "utf8");
  const context = { console, structuredClone };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "case-schema.js" });
  return context;
}

async function loadGradingRuntime() {
  const source = await fs.readFile(path.resolve("app-actions.js"), "utf8");
  const context = {
    console,
    structuredClone,
    Intl,
    setTimeout,
    clearTimeout,
    boot: () => Promise.resolve(),
    app: {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "app-actions.js" });
  await Promise.resolve();
  return context;
}

function rowValue(data, documentId, rowId, periodIndex = -1) {
  const document = data.documents.find((item) => item.id === documentId);
  const rows = [...(document.rows || []), ...(document.sections || []).flatMap((section) => section.rows || [])];
  return Number(rows.find((row) => row.id === rowId).values.at(periodIndex));
}

test("CASE 3 is a valid native v2 case with SaaS analysis skills", async () => {
  const runtime = await loadSchemaRuntime();
  const data = await readJson("data/cases/case-003-growth-that-burns-cash.json");
  const skills = await readJson("data/skills/index.json");
  const manifest = await readJson("data/cases/index.json");
  const entry = manifest.cases.find((item) => item.id === data.id);
  const normalized = runtime.normalizeCaseDefinition(data, entry);
  const validation = runtime.validateCaseDefinition(normalized, skills);

  assert.equal(data.schemaVersion, 2);
  assert.equal(normalized.source.migratedAtRuntime, false);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.unit-economics"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.cash-runway"));
  assert.ok(normalized.pedagogy.skillIds.includes("accounting.contract-liabilities"));
  assert.equal(normalized.pages.length, 8);
});

test("segment revenue and gross profit reconcile to the company P&L", async () => {
  const data = await readJson("data/cases/case-003-growth-that-burns-cash.json");
  const segment = data.documents.find((item) => item.id === "segment-unit-economics");
  const revenue = segment.rows.reduce((total, row) => total + Number(row.annualRevenue), 0);
  const grossProfit = segment.rows.reduce((total, row) => total + Number(row.annualRevenue) * Number(row.grossMarginRate) / 100, 0);

  assert.equal(revenue, rowValue(data, "saas-pl-comparison", "saas-revenue"));
  assert.equal(grossProfit, rowValue(data, "saas-pl-comparison", "saas-gross-profit"));
});

test("CASE 3 core calculations reproduce the expected answers", async () => {
  const data = await readJson("data/cases/case-003-growth-that-burns-cash.json");
  const segment = data.documents.find((item) => item.id === "segment-unit-economics");
  const forecast = data.documents.find((item) => item.id === "saas-runway-forecast");
  const bridge = data.documents.find((item) => item.id === "saas-cash-bridge");

  const grossMargin = rowValue(data, "saas-pl-comparison", "saas-gross-profit") / rowValue(data, "saas-pl-comparison", "saas-revenue") * 100;
  const cac = segment.startupAcquisitionSpend / segment.startupNewCustomers;
  const ltv = segment.startupMonthlyArpa * segment.startupGrossMarginRate / segment.startupMonthlyChurnRate;
  const runway = forecast.currentCash / forecast.monthlyNetBurn;
  const closingCash = bridge.openingCash + bridge.items.reduce((total, item) => total + Number(item.value), 0);

  assert.equal(grossMargin, 65);
  assert.equal(cac, 17.5);
  assert.ok(Math.abs(ltv - 12.5) < 0.001);
  assert.ok(Math.abs(runway - 8.2733) < 0.001);
  assert.equal(closingCash, bridge.closingCash);
});

test("CASE 3 scored steps total 120 points and use a global namespace", async () => {
  const data = await readJson("data/cases/case-003-growth-that-burns-cash.json");
  const steps = data.pages.flatMap((page) => page.steps || []);
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const total = data.scoring.autoScoredStepIds.reduce((sum, id) => sum + Number(stepMap.get(id)?.scoring?.maxPoints || 0), 0);

  assert.equal(total, 120);
  assert.equal(data.scoring.maxAutoScore, 120);
  assert.ok(steps.every((step) => step.id.startsWith("c003-step-")));
  assert.ok(data.scoring.autoScoredStepIds.every((id) => stepMap.has(id)));
});

test("recommendation scoring scales to each step's maximum points", async () => {
  const runtime = await loadGradingRuntime();
  const data2 = await readJson("data/cases/case-002-sleeping-hit-products.json");
  const data3 = await readJson("data/cases/case-003-growth-that-burns-cash.json");
  const decision2 = data2.pages.flatMap((page) => page.steps || []).find((step) => step.id === "c002-step-07-01");
  const decision3 = data3.pages.flatMap((page) => page.steps || []).find((step) => step.id === "c003-step-07-01");

  const result2 = runtime.gradeStep(decision2, decision2.preferredOptionIds);
  const result3 = runtime.gradeStep(decision3, decision3.preferredOptionIds);

  assert.equal(result2.correct, true);
  assert.equal(result2.score, 15);
  assert.equal(result3.correct, true);
  assert.equal(result3.score, 10);
});
