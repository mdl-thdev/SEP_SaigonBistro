// tests/e2e/menu.e2e.test.js
// E2E test for the Menu feature 
// npm run dev:backend > npm run dev:frontend > 
// npx playwright test tests/e2e/menu.e2e.test.js / npx playwright test tests/e2e
// npx playwright test tests/e2e/menu.e2e.test.js --headed
// Unlike Parts A/B, this does NOT mock Supabase - it opens a real browser
// against the running app (frontend + backend + real/seeded DB) and checks
// what an actual user sees on screen
//
// Prerequisite: the app must be running before this test executes, e.g.
//   npm run dev   (frontend, assumed at http://localhost:5173)
//   npm run start (backend API)

const { test, expect } = require("@playwright/test");

test.describe("E2E: Menu page user journey", () => {
  test("Happy Path: user opens the menu page and sees menu items load", async ({ page }) => {
    // Arrange - open the browser to the menu page
    await page.goto("http://localhost:5173/pages/menu/menu.html");

    // Act - wait for the menu to finish loading from the API
    await page.waitForSelector('[data-testid="menu-item"]');

    // Assert - result appears on screen
    const menuItems = page.locator('[data-testid="menu-item"]');
    await expect(menuItems.first()).toBeVisible();
    await expect(menuItems.first()).toContainText("Pho");
  });

  test("Happy Path: clicking a category filters the visible items", async ({ page }) => {
  // Arrange
  await page.goto("http://localhost:5173/pages/menu/menu.html");
  await page.waitForSelector('[data-testid="category-button"]');

  // Act - perform the user action: click a category
  await page.click('[data-testid="category-button"]:has-text("Noodles")');

  // Assert - verify the result appears on screen
  const menuItems = page.locator('[data-testid="menu-item"]');
  await expect(menuItems.first()).toBeVisible();

  // Target the heading specifically instead of any text containing "Noodles"
  await expect(page.locator('#menu-heading')).toHaveText("Noodles Items");
  });

  test("Edge Case: shows an empty state when no menu items exist", async ({ page }) => {
  // Arrange
  await page.route("**/api/menu", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: [],
        items: [],
        assets: {}
      }),
    });
  });

  // Act
  await page.goto("http://localhost:5173/pages/menu/menu.html");

  // Assert
  await expect(
    page.locator('[data-testid="menu-empty-message"]')
  ).toBeVisible();
  await expect(
  page.locator('[data-testid="menu-item"]')
  ).toHaveCount(0);
});
});