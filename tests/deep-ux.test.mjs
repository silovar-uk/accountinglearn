import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFile(new URL(file, root), "utf8");

test("deep assets are loaded after the base UI overrides", async () => {
  const html = await read("index.html");
  const order = ["ui-live.js", "deep-state.js", "deep-calculator.js", "deep-ui-shell.js", "deep-ui-home-case.js", "deep-ui-steps.js", "deep-ui-records-layers.js", "deep-actions.js", "pwa.js"].map((name) => html.indexOf(name));
  assert.ok(order.every((position) => position >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(html, /apple-touch-icon\.png/);
  for (const stylesheet of ["deep-1.css", "deep-2.css", "deep-3.css", "deep-4.css"]) assert.match(html, new RegExp(stylesheet.replace(".", "\\.")));
});

test("manifest provides installable PNG icons", async () => {
  const manifest = JSON.parse(await read("site.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "./");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.ok(manifest.icons.every((icon) => icon.type === "image/png"));
});

test("service worker caches the app shell and case content", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /accounting-quest-v\d+/);
  for (const asset of ["case-engine.js", "deep-state.js", "deep-calculator.js", "deep-ui-shell.js", "deep-ui-home-case.js", "deep-ui-steps.js", "deep-ui-records-layers.js", "deep-actions.js"]) assert.match(sw, new RegExp(asset.replace(".", "\\.")));
  assert.match(sw, /case-001-black-profit-no-cash\.json/);
  assert.match(sw, /self\.clients\.claim/);
});

test("calculator respects multiplication precedence", async () => {
  const code = await read("deep-calculator.js");
  const context = {
    state: { calculator: { tokens: [] }, calculationHistory: [] },
    formatNumber: String,
    saveState() {}, render() {}, showToast() {}, escapeHtml: String, deepIcon: () => "",
    navigator: { clipboard: { writeText: async () => {} } }, crypto: { randomUUID: () => "id" },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  const result = context.evaluateCalculatorTokens([
    { type: "number", value: 10 }, { type: "operator", value: "+" },
    { type: "number", value: 2 }, { type: "operator", value: "×" },
    { type: "number", value: 5 },
  ]);
  assert.equal(result, 20);
  assert.throws(() => context.evaluateCalculatorTokens([
    { type: "number", value: 10 }, { type: "operator", value: "÷" }, { type: "number", value: 0 },
  ]), /0では割れません/);
});

test("deep state defines migration, streak, attempts, and import validation", async () => {
  const source = await read("deep-state.js");
  for (const token of ["ensureDeepState", "getLearningStreak", "registerAttempt", "getSmartResumeIndex", "validateImportedPayload"]) {
    assert.match(source, new RegExp(token));
  }
});
