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

test("CASE 3 opens once, shows CASE 03, and stores namespaced answers", async ({ page }) => {
  await completeOnboarding(page);
  await page.locator('.bottom-nav [data-target="cases"]').click();

  const case3Card = page.locator('.case-card:not(.planned)').filter({ hasText: "売上が伸びるほど苦しくなる会社" });
  await expect(case3Card).toBeVisible();
  await expect(case3Card.locator(".case-number")).toHaveText("03");
  await expect(page.locator('.case-card.planned').filter({ hasText: "売上が伸びるほど苦しくなる会社" })).toHaveCount(0);
  await case3Card.locator('[data-action="open-case"]').click();

  await expect(page).toHaveURL(/#case\/case-003-growth-that-burns-cash\/0$/);
  await expect(page.getByRole("heading", { name: "成長祝いの翌朝" })).toBeVisible();
  await expect(page.locator(".outline-heading")).toContainText("CASE 03");
  await expectNoHorizontalOverflow(page);

  await page.locator('.case-footer [data-action="go-page"][data-page="1"]').click();
  await expect(page.getByRole("heading", { name: "最初に何を疑うか" })).toBeVisible();
  await page.getByRole("button", { name: "顧客層別の獲得費用と新規顧客数", exact: true }).click();
  await page.getByRole("button", { name: "顧客層別の単価と粗利率", exact: true }).click();
  await page.getByRole("button", { name: "顧客層別の解約率", exact: true }).click();
  await page.getByRole("button", { name: "月間ネットバーンと現預金", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.answers["c003-step-02-01"].correct).toBe(true);
  expect(stored.attemptHistory["c003-step-02-01"]).toHaveLength(1);
  expect(stored.answers["c002-step-02-01"]).toBeUndefined();
  expect(stored.answers["step-02-01"]).toBeUndefined();

  await page.reload();
  await expect(page.getByRole("heading", { name: "最初に何を疑うか" })).toBeVisible();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();
});

test("CASE 3 formula helpers preserve SaaS metric precision", async ({ page }) => {
  await completeOnboarding(page, "beginner");
  await page.goto("/#case/case-003-growth-that-burns-cash/4");
  await expect(page.getByRole("heading", { name: "1社を増やすほど赤字になる" })).toBeVisible();
  await expect(page.locator('[data-step-id="c003-step-05-01"] .deep-formula')).toContainText("4,200 ÷ 240");
  await expect(page.locator('[data-step-id="c003-step-05-02"] .deep-formula')).toContainText("1.5 × 0.5 ÷ 0.06");
  await expectNoHorizontalOverflow(page);
});

test("CASE 3 runway and contract liability entry work on the same page", async ({ page }) => {
  await completeOnboarding(page, "beginner");
  await page.goto("/#case/case-003-growth-that-burns-cash/5");
  await expect(page.getByRole("heading", { name: "残された時間と、売上になる前のお金" })).toBeVisible();
  await expect(page.locator('[data-step-id="c003-step-06-01"] .deep-formula')).toContainText("4,964 ÷ 600");

  const journal = page.locator('[data-step-id="c003-step-06-02"]');
  await journal.locator('select[data-field="debitAccountId"]').selectOption("saas-cash-account");
  await journal.locator('input[data-field="debitAmount"]').fill("120");
  await journal.locator('select[data-field="creditAccountId"]').selectOption("saas-contract-liability-account");
  await journal.locator('input[data-field="creditAmount"]').fill("120");
  await journal.getByRole("button", { name: "答えを確認" }).click();
  await expect(journal.getByText("その考え方で正解です", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
