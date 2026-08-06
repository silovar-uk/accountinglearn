import { test, expect } from "@playwright/test";

const STORAGE_KEY = "accounting-quest:v1";
const browserErrors = new WeakMap();

async function completeOnboarding(page) {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "どのくらい補助を使いますか？" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /標準/ }).click();
    await dialog.getByRole("button", { name: "この設定で始める" }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByRole("heading", { name: "数字を、経営の言葉に変える。" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

async function startCase(page) {
  await page.locator('.resume-card [data-action="open-case"]').click();
  await expect(page.getByRole("heading", { name: "案件受領" })).toBeVisible();
  await expect(page).toHaveURL(/#case\/case-001-black-profit-no-cash\/0$/);
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

test("home, case library, and page map remain usable", async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.locator('.bottom-nav [data-target="home"]')).toHaveClass(/active/);
  await expect(page.getByText("物語を読む", { exact: true })).toBeVisible();
  await expect(page.getByText("数字を調べる", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.locator('.bottom-nav [data-target="cases"]').click();
  await expect(page.getByRole("heading", { name: "経営ケース" })).toBeVisible();
  await page.locator('.case-card [data-action="open-case"]').first().click();
  await expect(page.getByRole("heading", { name: "案件受領" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "ページ一覧を開く" }).click();
  const pageMap = page.getByRole("dialog", { name: "ページ一覧" });
  await expect(pageMap).toBeVisible();
  await expect(pageMap.locator('button[data-page="1"]')).toBeEnabled();
  await expect(pageMap.locator('button[data-page="2"]')).toBeDisabled();
  await pageMap.getByRole("button", { name: "閉じる" }).click();
  await expect(pageMap).toBeHidden();
});

test("a checked answer persists after reload and unlocks the next page", async ({ page }) => {
  await completeOnboarding(page);
  await startCase(page);

  await page.locator('.case-footer [data-action="go-page"][data-page="1"]').click();
  await expect(page.getByRole("heading", { name: "最初に何を確認するか" })).toBeVisible();

  await page.getByRole("button", { name: "売掛金の増減と入金時期" }).click();
  await page.getByRole("button", { name: "機材や設備への支出" }).click();
  await page.getByRole("button", { name: "答えを確認" }).click();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "最初に何を確認するか" })).toBeVisible();
  await expect(page.getByText("その考え方で正解です", { exact: true })).toBeVisible();

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.answers["step-02-01"].checked).toBe(true);
  expect(stored.answers["step-02-01"].correct).toBe(true);
  expect(stored.attemptHistory["step-02-01"]).toHaveLength(1);

  await page.locator('.case-footer [data-action="go-page"][data-page="2"]').click();
  await expect(page.getByRole("heading", { name: "数字の変化を見つける" })).toBeVisible();
});

test("mobile financial values feed the calculator without layout overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only interaction");

  await completeOnboarding(page);
  await page.goto("/#case/case-001-black-profit-no-cash/2");
  await expect(page.getByRole("heading", { name: "数字の変化を見つける" })).toBeVisible();
  await expect(page.locator(".mobile-financial-list").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.locator('.mobile-financial-list button[data-label="売上高・当期"]').click();
  let calculator = page.getByRole("dialog", { name: "計算トレイ" });
  await expect(calculator).toBeVisible();
  await expect(calculator.getByLabel("選択した数値").getByText("10,400", { exact: true })).toBeVisible();
  await calculator.getByRole("button", { name: "−", exact: true }).click();
  await calculator.getByRole("button", { name: "計算トレイを閉じる" }).click();

  await page.locator('.mobile-financial-list button[data-label="売上高・前期"]').click();
  calculator = page.getByRole("dialog", { name: "計算トレイ" });
  await calculator.getByRole("button", { name: "計算する" }).click();
  await expect(calculator.locator("output")).toContainText("2,400");
  await expectNoHorizontalOverflow(page);
});

test("the cached app shell can reopen while offline", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "One browser is sufficient for the offline contract");

  await completeOnboarding(page);
  const workerUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL || "";
  });
  expect(workerUrl).toMatch(/\/sw\.js$/);

  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "数字を、経営の言葉に変える。" })).toBeVisible();
  await expect(page.getByText("オフラインです。保存済みの教材で学習できます。", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
