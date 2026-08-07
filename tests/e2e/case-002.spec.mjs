import { test, expect } from "@playwright/test";

const STORAGE_KEY = "accounting-quest:v1";
const browserErrors = new WeakMap();

async function completeOnboarding(page, mode = "standard") {
  await page.goto("/");
  await page.locator("#app > *").first().waitFor();
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

test("CASE 2 opens once, shows CASE 02, and stores namespaced answers", async ({ page }) => {
  await completeOnboarding(page);
  await page.locator('.bottom-nav [data-target="cases"]').click();

  const case2Card = page.locator('.case-card:not(.planned)').filter({ hasText: "倉庫に眠るヒット商品" });
  await expect(case2Card).toBeVisible();
  await expect(case2Card.locator(".case-number")).toHaveText("02");
  await expect(page.locator('.case-card.planned').filter({ hasText: "倉庫に眠るヒット商品" })).toHaveCount(0);
  await case2Card.locator('[data-action="open-case"]').click();

  await expect(page).toHaveURL(/#case\/case-002-sleeping-hit-products\/0$/);
  await expect(page.getByRole("heading", { name: "倉庫からのSOS" })).toBeVisible();
  await expect(page.locator(".outline-heading")).toContainText("CASE 02");
  await expectNoHorizontalOverflow(page);

  await page.locator('.case-footer [data-action="go-page"][data-page="1"]').click();
  await expect(page.getByRole("heading", { name: "最初に何を疑うか" })).toBeVisible();
  await page.getByRole("button", { name: "売上総利益率の前年差", exact: true }).click();
  await page.getByRole("button", { name: "商品別の在庫量と在庫月数", exact: true }).click();
  await page.getByRole("button", { name: "商品別の値引率と実売単価", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.answers["c002-step-02-01"].correct).toBe(true);
  expect(stored.attemptHistory["c002-step-02-01"]).toHaveLength(1);
  expect(stored.answers["step-02-01"]).toBeUndefined();

  await page.reload();
  await expect(page.getByRole("heading", { name: "最初に何を疑うか" })).toBeVisible();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();
});

test("CASE 2 formula helper resolves its own financial data", async ({ page }) => {
  await completeOnboarding(page, "beginner");
  await page.goto("/#case/case-002-sleeping-hit-products/3");
  await expect(page.getByRole("heading", { name: "売上より速く増えたもの" })).toBeVisible();
  await expect(page.locator('[data-step-id="c002-step-04-01"] .deep-formula')).toContainText("7,650 ÷ 22,500 × 100");
  await expectNoHorizontalOverflow(page);
});
