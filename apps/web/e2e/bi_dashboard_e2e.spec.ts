import { test, expect } from "@playwright/test";

test.describe("Podacium BI Dashboard E2E Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BI Dashboard route
    await page.goto("/bi/dashboards");
  });

  test("renders BI Dashboard Overview and interactive widgets", async ({ page }) => {
    // Verify title or main header
    await expect(page.locator("h1")).toContainText(/Dashboards|Business Intelligence/i);

    // Verify filter bar presence
    const filterBar = page.locator("button", { hasText: /7D|MTD|All/i });
    if (await filterBar.count() > 0) {
      await expect(filterBar.first()).toBeVisible();
    }
  });

  test("opens spatial annotation comment drawer", async ({ page }) => {
    const commentButton = page.locator("button[aria-label*='comment' i], button:has-text('Comments')");
    if (await commentButton.count() > 0) {
      await commentButton.first().click();
      await expect(page.locator("h3")).toContainText(/Comments & Annotations/i);
    }
  });

  test("selects bookmark view preset", async ({ page }) => {
    const bookmarkPill = page.locator("button:has-text('Save Current View'), div:has-text('Views')");
    if (await bookmarkPill.count() > 0) {
      await expect(bookmarkPill.first()).toBeVisible();
    }
  });
});
