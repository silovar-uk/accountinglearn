import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const data = JSON.parse(await fs.readFile(new URL("../data/cases/case-001-black-profit-no-cash.json", import.meta.url), "utf8"));

test("case has eight ordered pages", () => {
  assert.equal(data.pages.length, 8);
  assert.deepEqual(data.pages.map((page) => page.order), [1,2,3,4,5,6,7,8]);
});

test("cash story reconciles", () => {
  const bridge = data.documents.find((document) => document.id === "cash-flow-bridge");
  const total = bridge.openingCash + bridge.items.filter((item) => item.category !== "subtotal").reduce((sum, item) => sum + item.value, 0);
  assert.equal(total, bridge.closingCash);
});

test("next-month cash forecast reconciles", () => {
  const forecast = data.documents.find((document) => document.id === "next-month-cash-plan");
  const inflow = forecast.cashInflows.reduce((sum, item) => sum + item.value, 0);
  const outflow = forecast.cashOutflows.reduce((sum, item) => sum + item.value, 0);
  assert.equal(forecast.openingCash + inflow - outflow, forecast.expectedClosingCash);
});

test("all scored step ids exist", () => {
  const ids = new Set(data.pages.flatMap((page) => (page.steps || []).map((step) => step.id)));
  for (const id of data.scoring.autoScoredStepIds) assert.ok(ids.has(id), id);
});
