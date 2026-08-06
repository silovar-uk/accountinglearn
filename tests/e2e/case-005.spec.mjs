import { test, expect } from "@playwright/test";

const browserErrors = new WeakMap();

async function completeOnboarding(page, mode = "beginner") {
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

test("CASE 5 is published and records the initial judgment without treating it as a mistake", async ({ page }) => {
  await completeOnboarding(page);
  await page.locator('.bottom-nav [data-target="cases"]').click();
  const card = page.locator('.case-card:not(.planned)').filter({ hasText: "満席の店から撤退すべきか" });
  await expect(card).toBeVisible();
  await expect(card.locator(".case-number")).toHaveText("05");
  await expect(page.locator('.case-card.planned').filter({ hasText: "満席の店から撤退すべきか" })).toHaveCount(0);
  await card.locator('[data-action="open-case"]').click();

  await expect(page.getByRole("heading", { name: "満席なのに、閉店候補" })).toBeVisible();
  await page.getByRole("button", { name: "店舗PLが赤字なので閉店する", exact: true }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("accounting-quest:v1")));
  expect(stored.answers["c005-step-01-01"].correct).toBe(true);
  expect(stored.mistakes.some((item) => item.stepId === "c005-step-01-01")).toBe(false);
  await expectNoHorizontalOverflow(page);
});

test("CASE 5 decision bridge stays neutral until the learner checks the exit calculation", async ({ page }) => {
  await completeOnboarding(page, "beginner");
  await page.goto("/#case/case-005-restaurant-exit-decision/3");
  await expect(page.getByRole("heading", { name: "閉店すると、年間利益は悪化する" })).toBeVisible();
  await expect(page.locator(".aq-bridge-result")).toContainText("計算後に表示");
  await expect(page.locator('[data-step-id="c005-step-04-01"] .deep-formula')).toContainText("5,100 − 3,540");
  await expect(page.locator('[data-step-id="c005-step-04-02"] .deep-formula')).toContainText("3,540 − 5,100");

  const step = page.locator('[data-step-id="c005-step-04-02"]');
  await step.locator('input[data-answer-input="c005-step-04-02"]').fill("-1560");
  await step.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.locator(".aq-bridge-result")).toContainText("-1,560");
  await expectNoHorizontalOverflow(page);
});

test("CASE 5 mobile scenario room and decision journey fit without overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only layout contract");
  await completeOnboarding(page);
  await page.goto("/#case/case-005-restaurant-exit-decision/5");
  await expect(page.getByRole("heading", { name: "撤退ではなく、選択肢を比べる" })).toBeVisible();
  await expect(page.locator(".aq-scenario-grid article")).toHaveCount(4);
  await expectNoHorizontalOverflow(page);
});
