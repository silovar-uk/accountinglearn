import { test, expect } from "@playwright/test";

const STORAGE_KEY = "accounting-quest:v1";
const browserErrors = new WeakMap();

async function completeOnboarding(page, mode = "standard") {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "どのくらい補助を使いますか？" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: mode === "beginner" ? /はじめて/ : /標準/ }).click();
    await dialog.getByRole("button", { name: "この設定で始める" }).click();
    await expect(dialog).toBeHidden();
  }
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) || []).toEqual([]);
});

test("CASE 4 opens once, shows CASE 04, and stores namespaced answers", async ({ page }) => {
  await completeOnboarding(page);
  await page.locator('.bottom-nav [data-target="cases"]').click();

  const case4Card = page.locator('.case-card:not(.planned)').filter({ hasText: "工場は忙しいのに、利益が消えた" });
  await expect(case4Card).toBeVisible();
  await expect(case4Card.locator(".case-number")).toHaveText("04");
  await expect(page.locator('.case-card.planned').filter({ hasText: "工場は忙しいのに、利益が消えた" })).toHaveCount(0);
  await case4Card.locator('[data-action="open-case"]').click();

  await expect(page).toHaveURL(/#case\/case-004-busy-factory-vanishing-profit\/0$/);
  await expect(page.getByRole("heading", { name: "残業続きの工場" })).toBeVisible();
  await expect(page.locator(".outline-heading")).toContainText("CASE 04");
  await expectNoHorizontalOverflow(page);

  await page.locator('.case-footer [data-action="go-page"][data-page="1"]').click();
  await expect(page.getByRole("heading", { name: "最初に何を疑うか" })).toBeVisible();
  await page.getByRole("button", { name: "製品別の制約時間当たり限界利益", exact: true }).click();
  await page.getByRole("button", { name: "固定製造間接費の予算差異・操業度差異", exact: true }).click();
  await page.getByRole("button", { name: "段取り替え・手直しに使った設備時間", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.answers["c004-step-02-01"].correct).toBe(true);
  expect(stored.attemptHistory["c004-step-02-01"]).toHaveLength(1);
  expect(stored.answers["c003-step-02-01"]).toBeUndefined();
  expect(stored.answers["c002-step-02-01"]).toBeUndefined();
  expect(stored.answers["step-02-01"]).toBeUndefined();

  await page.reload();
  await expect(page.getByRole("heading", { name: "最初に何を疑うか" })).toBeVisible();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();
});

test("CASE 4 overhead helpers and variance journal work", async ({ page }) => {
  await completeOnboarding(page, "beginner");
  await page.goto("/#case/case-004-busy-factory-vanishing-profit/3");
  await expect(page.getByRole("heading", { name: "高稼働なのに、固定費が配れない" })).toBeVisible();
  await expect(page.locator('[data-step-id="c004-step-04-01"] .deep-formula')).toContainText("6,000 ÷ 12,000");
  await expect(page.locator('[data-step-id="c004-step-04-02"] .deep-formula')).toContainText("6,600 − 4,500");

  const journal = page.locator('[data-step-id="c004-step-04-04"]');
  await journal.locator('select[data-field="debitAccountId"]').selectOption("cost-of-sales-account");
  await journal.locator('input[data-field="debitAmount"]').fill("2100");
  await journal.locator('select[data-field="creditAccountId"]').selectOption("manufacturing-overhead-variance");
  await journal.locator('input[data-field="creditAmount"]').fill("2100");
  await journal.getByRole("button", { name: "答えを確認" }).click();
  await expect(journal.getByText("その考え方で正解です", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("CASE 4 bottleneck helpers preserve opportunity-cost calculations", async ({ page }) => {
  await completeOnboarding(page, "beginner");
  await page.goto("/#case/case-004-busy-factory-vanishing-profit/5");
  await expect(page.getByRole("heading", { name: "その受注に、いくらの時間を渡すか" })).toBeVisible();
  await expect(page.locator('[data-step-id="c004-step-06-01"] .deep-formula')).toContainText("1.2 × 1,000");
  await expect(page.locator('[data-step-id="c004-step-06-02"] .deep-formula')).toContainText("6.4 + 2 × 2");
  await expectNoHorizontalOverflow(page);
});
