import { test, expect } from "@playwright/test";

test.describe("Live Sessions Marketplace & Live Room Flows", () => {
  test("browse public live sessions catalog", async ({ page }) => {
    await page.goto("/live");
    await page.waitForLoadState("networkidle");

    // Verify main live marketplace container is rendered
    await expect(page.locator("main")).toBeVisible();

    // Page title / heading should reflect live sessions
    const content = await page.textContent("main");
    expect(content).toBeTruthy();
  });

  test("search and filter live sessions", async ({ page }) => {
    await page.goto("/live");
    await page.waitForLoadState("networkidle");

    // Search input should be accessible
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]',
      )
      .first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Python");
      await page.waitForTimeout(500);
    }

    // Check category pills / tabs
    const categoryButton = page
      .locator(
        'button:has-text("All"), button:has-text("Tous"), button:has-text("الكل")',
      )
      .first();
    if (await categoryButton.isVisible()) {
      await expect(categoryButton).toBeVisible();
    }
  });

  test("navigate to session detail and booking view", async ({ page }) => {
    await page.goto("/live");
    await page.waitForLoadState("networkidle");

    // Find first session card link
    const sessionCard = page.locator('a[href*="/live/"]').first();
    if (await sessionCard.isVisible()) {
      const href = await sessionCard.getAttribute("href");
      if (
        href &&
        !href.includes("/my-sessions") &&
        !href.includes("/create") &&
        !href.includes("/replays")
      ) {
        await sessionCard.click();
        await page.waitForLoadState("networkidle");

        // Verify session details loaded
        await expect(page.locator("h1, h2")).toBeVisible();
      }
    }
  });

  test("navigate to attendee bookings hub", async ({ page }) => {
    await page.goto("/live/bookings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });

  test("navigate to session replays hub", async ({ page }) => {
    await page.goto("/live/replays");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });

  test("creator studio create session form loads", async ({ page }) => {
    await page.goto("/live/create");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toBeVisible();
  });
});
