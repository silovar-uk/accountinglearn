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

function row(data, id) {
  for (const document of data.documents) {
    const found = (document.rows || []).find((item) => item.id === id);
    if (found) return found;
  }
  return null;
}

function value(data, id) {
  const item = row(data, id);
  const raw = Array.isArray(item?.values) ? item.values.at(-1) : item?.value;
  return Number(raw);
}

test("CASE 5 is a valid native v2 restaurant exit case", async () => {
  const runtime = await loadSchemaRuntime();
  const data = await readJson("data/cases/case-005-restaurant-exit-decision.json");
  const skills = await readJson("data/skills/index.json");
  const manifest = await readJson("data/cases/index.json");
  const entry = manifest.cases.find((item) => item.id === data.id);
  const normalized = runtime.normalizeCaseDefinition(data, entry);
  const validation = runtime.validateCaseDefinition(normalized, skills);

  assert.equal(data.schemaVersion, 2);
  assert.equal(normalized.source.migratedAtRuntime, false);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(data.pages.length, 8);
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.exit-decision"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.scenario-comparison"));
});

test("CASE 5 store P&L reconciles and closing without an alternative worsens profit", async () => {
  const data = await readJson("data/cases/case-005-restaurant-exit-decision.json");
  const revenue = value(data, "c005-store-revenue");
  const variable = value(data, "c005-store-variable-cost");
  const contribution = value(data, "c005-store-contribution-margin");
  const avoidable = value(data, "c005-store-avoidable-fixed");
  const unavoidable = value(data, "c005-store-unavoidable-fixed");
  const headquarters = value(data, "c005-store-hq-allocation");
  const loss = value(data, "c005-store-operating-loss");

  assert.equal(revenue - variable, contribution);
  assert.equal(contribution - avoidable - unavoidable - headquarters, loss);
  assert.equal(avoidable - contribution, -1560);
  assert.equal(contribution - avoidable, 1560);
});

test("CASE 5 cost classifications and exit cash totals reconcile", async () => {
  const data = await readJson("data/cases/case-005-restaurant-exit-decision.json");
  const avoidableIds = ["c005-manager-cost", "c005-fulltime-staff", "c005-utilities-base", "c005-local-promotion", "c005-maintenance"];
  const avoidableTotal = avoidableIds.reduce((sum, id) => sum + value(data, id), 0);
  const bookLoss = value(data, "c005-equipment-book-value") - value(data, "c005-equipment-sale");
  const immediateExitCost = value(data, "c005-removal-cost") + value(data, "c005-lease-penalty");
  const netExitCash = immediateExitCost - value(data, "c005-equipment-sale");

  assert.equal(avoidableTotal, value(data, "c005-store-avoidable-fixed"));
  assert.equal(bookLoss, 1500);
  assert.equal(immediateExitCost, 850);
  assert.equal(netExitCash, 550);
});

test("CASE 5 scenario values and three-year alternative threshold are consistent", async () => {
  const data = await readJson("data/cases/case-005-restaurant-exit-decision.json");
  const scenarios = data.documents.find((item) => item.id === "c005-scenarios");
  const replacement = scenarios.rows.find((item) => item.id === "c005-scenario-replace");
  const improvement = scenarios.rows.find((item) => item.id === "c005-scenario-improve");
  const closure = scenarios.rows.find((item) => item.id === "c005-scenario-close");
  const threshold = 1560 + value(data, "c005-replacement-investment") / 3;

  assert.equal(threshold, 2160);
  assert.equal(replacement.yearOneImpact, replacement.annualImpact + replacement.initialCash);
  assert.equal(improvement.yearOneImpact, improvement.annualImpact + improvement.initialCash);
  assert.equal(closure.yearOneImpact, closure.annualImpact + closure.initialCash);
  assert.equal(closure.initialCash, -550);
  assert.ok(2400 > threshold);
});

test("CASE 5 scored steps total 115 and visual sources resolve", async () => {
  const data = await readJson("data/cases/case-005-restaurant-exit-decision.json");
  const steps = data.pages.flatMap((page) => page.steps || []);
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const total = data.scoring.autoScoredStepIds.reduce((sum, id) => sum + Number(stepMap.get(id)?.scoring?.maxPoints || 0), 0);
  const bridge = data.documents.find((item) => item.id === "c005-decision-bridge");

  assert.equal(total, 115);
  assert.ok(steps.every((step) => step.id.startsWith("c005-step-")));
  assert.ok(bridge.items.every((item) => row(data, item.sourceValueId)));
  assert.equal(bridge.result, bridge.items.reduce((sum, item) => sum + value(data, item.sourceValueId) * item.multiplier, 0));
});
