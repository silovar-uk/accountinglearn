import { test, expect } from "@playwright/test";

const STORAGE_KEY = "accounting-quest:v1";
const browserErrors = new WeakMap();

async function completeOnboarding(page) {
  await page.goto("/");
  await page.locator("#app > *").first().waitFor();
  const dialog = page.getByRole("dialog", { name: "どのくらい補助を使いますか？" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /標準/ }).click();
    await dialog.getByRole("button", { name: "この設定で始める" }).click();
  }
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

test("a foundation lesson completes, persists, and updates skill mastery", async ({ page }) => {
  await completeOnboarding(page);
  await page.locator('.bottom-nav [data-target="basics"]').click();
  await expect(page.getByRole("heading", { name: "ケースにつながる簿記基礎" })).toBeVisible();

  await page.locator('.basics-lesson-card [data-action="basics-start"]').first().click();
  await expect(page).toHaveURL(/#basics\/revenue-and-cash\/0$/);
  await expect(page.locator(".basics-intro-card").getByRole("heading", { name: "売上と入金は、同じ日ではない", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "問題へ進む" }).click();

  await page.getByRole("button", { name: "6月30日", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.locator(".basics-question-card .feedback strong")).toHaveText("正解です");
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByLabel("回答（万円）").fill("30");
  await page.getByRole("button", { name: "答えを確認" }).click();
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByRole("button", { name: "貸借対照表の売掛金", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByRole("button", { name: "売上高が100万円増える", exact: true }).click();
  await page.getByRole("button", { name: "売掛金が100万円増える", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await page.getByRole("button", { name: "次へ" }).click();

  await expect(page.locator(".basics-summary-score").getByText("100%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "単元を完了" }).click();
  await expect(page).toHaveURL(/#basics$/);
  await expect(page.getByRole("heading", { name: "ケースにつながる簿記基礎" })).toBeVisible();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.basicsProgress["revenue-and-cash"].completedAt).toBeTruthy();
  expect(stored.skillProgress["accounting.accrual-basis"].mastered).toBe(true);
  expect(stored.skillProgress["statements.pl-bs-connection"].mastery).toBe(100);

  await page.reload();
  await expect(page.locator(".basics-lesson-card").first()).toContainText("COMPLETED");
});
