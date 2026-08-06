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

test("CASE 2 is a valid native v2 case with declared inventory skills", async () => {
  const runtime = await loadSchemaRuntime();
  const data = await readJson("data/cases/case-002-sleeping-hit-products.json");
  const skills = await readJson("data/skills/index.json");
  const manifest = await readJson("data/cases/index.json");
  const entry = manifest.cases.find((item) => item.id === data.id);
  const normalized = runtime.normalizeCaseDefinition(data, entry);
  const validation = runtime.validateCaseDefinition(normalized, skills);

  assert.equal(data.schemaVersion, 2);
  assert.equal(normalized.source.migratedAtRuntime, false);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.ok(normalized.pedagogy.skillIds.includes("accounting.inventory-valuation"));
  assert.ok(normalized.pedagogy.skillIds.includes("analysis.sku-profitability"));
  assert.equal(normalized.pages.length, 8);
});

test("SKU totals reconcile to the company financial statements", async () => {
  const data = await readJson("data/cases/case-002-sleeping-hit-products.json");
  const sku = data.documents.find((item) => item.id === "sku-profitability");
  const sum = (field) => sku.rows.reduce((total, row) => total + Number(row[field]), 0);

  assert.equal(sum("sales"), rowValue(data, "pl-comparison", "revenue"));
  assert.equal(sum("grossProfit"), rowValue(data, "pl-comparison", "gross-profit"));
  assert.equal(sum("endingInventory"), rowValue(data, "bs-comparison", "inventory"));
});

test("CASE 2 core calculations reproduce the expected answers", async () => {
  const data = await readJson("data/cases/case-002-sleeping-hit-products.json");
  const detail = data.documents.find((item) => item.id === "celebration-tee-detail").rows[0];
  const grossMargin = rowValue(data, "pl-comparison", "gross-profit") / rowValue(data, "pl-comparison", "revenue") * 100;
  const sellThrough = detail.soldUnits / detail.producedUnits * 100;
  const inventoryDays = rowValue(data, "bs-comparison", "inventory") / rowValue(data, "pl-comparison", "cost-of-sales") * 365;
  const valuationLoss = detail.endingUnits * (detail.unitCost - detail.netRealisableValue);

  assert.equal(grossMargin, 34);
  assert.equal(sellThrough, 60);
  assert.ok(Math.abs(inventoryDays - 117.9798) < 0.001);
  assert.ok(Math.abs(valuationLoss - 360) < 0.000001);
});

test("CASE 2 scored steps total 115 points and use a global namespace", async () => {
  const data = await readJson("data/cases/case-002-sleeping-hit-products.json");
  const steps = data.pages.flatMap((page) => page.steps || []);
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const total = data.scoring.autoScoredStepIds.reduce((sum, id) => sum + Number(stepMap.get(id)?.scoring?.maxPoints || 0), 0);

  assert.equal(total, 115);
  assert.equal(data.scoring.maxAutoScore, 115);
  assert.ok(steps.every((step) => step.id.startsWith("c002-step-")));
  assert.ok(data.scoring.autoScoredStepIds.every((id) => stepMap.has(id)));
});

test("all manifest cases have globally unique step ids", async () => {
  const manifest = await readJson("data/cases/index.json");
  const owners = new Map();
  for (const entry of manifest.cases) {
    const data = await readJson(entry.path);
    for (const step of data.pages.flatMap((page) => page.steps || [])) {
      assert.equal(owners.has(step.id), false, `${step.id} already belongs to ${owners.get(step.id)}`);
      owners.set(step.id, entry.id);
    }
  }
  assert.ok(owners.size >= 20);
});
