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

function rowValue(data, documentId, rowId, periodIndex = -1) {
  const document = data.documents.find((item) => item.id === documentId);
  const rows = [...(document.rows || []), ...(document.sections || []).flatMap((section) => section.rows || [])];
  return Number(rows.find((row) => row.id === rowId).values.at(periodIndex));
}

test("CASE 4 is a valid native v2 manufacturing case", async () => {
  const runtime = await loadSchemaRuntime();
  const data = await readJson("data/cases/case-004-busy-factory-vanishing-profit.json");
  const skills = await readJson("data/skills/index.json");
  const manifest = await readJson("data/cases/index.json");
  const entry = manifest.cases.find((item) => item.id === data.id);
  const normalized = runtime.normalizeCaseDefinition(data, entry);
  const validation = runtime.validateCaseDefinition(normalized, skills);

  assert.equal(data.schemaVersion, 2);
  assert.equal(normalized.source.migratedAtRuntime, false);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.ok(normalized.pedagogy.skillIds.includes("accounting.manufacturing-overhead"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.overhead-variance"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.bottleneck-throughput"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.product-mix"));
  assert.equal(normalized.pages.length, 8);
});

test("product economics reconcile to the company P&L and overhead variance", async () => {
  const data = await readJson("data/cases/case-004-busy-factory-vanishing-profit.json");
  const products = data.documents.find((item) => item.id === "product-economics");
  const overhead = data.documents.find((item) => item.id === "overhead-capacity");
  const metric = (id) => Number(overhead.rows.find((row) => row.id === id).value);

  const sales = products.rows.reduce((total, row) => total + Number(row.sales), 0);
  const variableCost = products.rows.reduce((total, row) => total + Number(row.variableCost), 0);
  const productiveHours = products.rows.reduce((total, row) => total + Number(row.productiveHours), 0);
  const setupReworkHours = products.rows.reduce((total, row) => total + Number(row.setupReworkHours), 0);
  const allocatedFixed = products.rows.reduce((total, row) => total + Number(row.allocatedFixedOverhead), 0);
  const productProfit = products.rows.reduce((total, row) => total + Number(row.accountingGrossProfit), 0);
  const companyGrossProfit = rowValue(data, "pl-comparison", "gross-profit");

  assert.equal(sales, rowValue(data, "pl-comparison", "revenue"));
  assert.equal(variableCost, rowValue(data, "pl-comparison", "variable-manufacturing-cost"));
  assert.equal(productiveHours, metric("productive-standard-hours"));
  assert.equal(setupReworkHours, metric("setup-rework-hours"));
  assert.equal(productiveHours + setupReworkHours, metric("occupied-hours"));
  assert.equal(productProfit - companyGrossProfit, metric("actual-fixed-overhead") - allocatedFixed);
});

test("CASE 4 overhead calculations reproduce the expected variances", async () => {
  const data = await readJson("data/cases/case-004-busy-factory-vanishing-profit.json");
  const overhead = data.documents.find((item) => item.id === "overhead-capacity");
  const metric = (id) => Number(overhead.rows.find((row) => row.id === id).value);

  const rate = metric("budgeted-fixed-overhead") / metric("normal-capacity-hours");
  const applied = metric("productive-standard-hours") * rate;
  const spendingVariance = metric("actual-fixed-overhead") - metric("budgeted-fixed-overhead");
  const volumeVariance = (metric("normal-capacity-hours") - metric("productive-standard-hours")) * rate;
  const underapplied = metric("actual-fixed-overhead") - applied;

  assert.equal(rate, 0.5);
  assert.equal(applied, 4500);
  assert.equal(spendingVariance, 600);
  assert.equal(volumeVariance, 1500);
  assert.equal(underapplied, 2100);
  assert.equal(spendingVariance + volumeVariance, underapplied);
});

test("CASE 4 bottleneck calculations reproduce opportunity cost and required price", async () => {
  const data = await readJson("data/cases/case-004-busy-factory-vanishing-profit.json");
  const products = data.documents.find((item) => item.id === "product-economics");
  const custom = products.rows.find((row) => row.id === "product-custom-mount");
  const standard = products.rows.find((row) => row.id === "product-standard-bracket");
  const contributionPerHour = Number(custom.contribution) / Number(custom.productiveHours);
  const opportunityCost = (Number(standard.contributionPerHour) - contributionPerHour) * 1000;
  const variableCostPerUnit = Number(custom.variableCost) / Number(custom.units);
  const productiveHoursPerUnit = Number(custom.productiveHours) / Number(custom.units);
  const requiredPrice = variableCostPerUnit + Number(standard.contributionPerHour) * productiveHoursPerUnit;

  assert.equal(contributionPerHour, 0.8);
  assert.equal(opportunityCost, 1200);
  assert.equal(requiredPrice, 10.4);
});

test("CASE 4 scored steps total 135 points and use a global namespace", async () => {
  const data = await readJson("data/cases/case-004-busy-factory-vanishing-profit.json");
  const steps = data.pages.flatMap((page) => page.steps || []);
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const total = data.scoring.autoScoredStepIds.reduce((sum, id) => sum + Number(stepMap.get(id)?.scoring?.maxPoints || 0), 0);
  const journal = stepMap.get("c004-step-04-04");

  assert.equal(total, 135);
  assert.equal(data.scoring.maxAutoScore, 135);
  assert.ok(steps.every((step) => step.id.startsWith("c004-step-")));
  assert.ok(data.scoring.autoScoredStepIds.every((id) => stepMap.has(id)));
  assert.equal(journal.expectedEntries[0].debitAmount, journal.expectedEntries[0].creditAmount);
  assert.equal(journal.expectedEntries[0].debitAmount, 2100);
});
