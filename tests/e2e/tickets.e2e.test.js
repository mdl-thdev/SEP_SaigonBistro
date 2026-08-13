// tests/e2e/tickets.e2e.test.js
// E2E test for the Create a Ticket feature
// npm run dev:frontend   (http://localhost:5173)
// npx playwright test tests/e2e/tickets.e2e.test.js --headed   / npx playwright install chromium / npx playwright install --with-deps chromium
// Ticket creation requires an authenticated session,
// this test never lets a real POST /tickets reach a real server
// Two things are intercepted at the network boundary before the page loads:
//   1) the ES module frontend/public/js/supabaseClient.js is served as a stub that returns a
//      canned logged-in session, this satisfies requireLoginOrRedirect() without a real
//      Supabase Auth call and without needing to reverse-engineer supabase-js's localStorage
//      session format (which is a private implementation detail of a CDN-pulled dependency)
//   2) /api/profiles/me and POST /tickets are stubbed with page.route()


const { test, expect } = require("@playwright/test");

async function stubSupabaseSession(page, user) {
  // Intercept the ES module import itself, not a network endpoint, this decouples the test
  // from supabase-js's internal storage schema entirely.
  await page.route("**/js/supabaseClient.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        export const supabase = {
          auth: {
            getSession: async () => ({
              data: { session: { access_token: "fake-access-token", user: ${JSON.stringify(user)} } },
              error: null,
            }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
            signOut: async () => ({ error: null }),
          },
          from: () => ({}),
        };
      `,
    })
  );
}

test.describe("E2E: Create a Ticket user journey", () => {
  const CUSTOMER = { id: "e2e-customer-1", email: "e2e.customer@example.com" };

  test.beforeEach(async ({ page }) => {
    await stubSupabaseSession(page, CUSTOMER);

    // STUB: profile lookup used only to render "Hi, <name>" in the header - non-critical,
    // stubbed so no request escapes to a real backend.
    await page.route("**/api/profiles/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profile: { role: "customer", display_name: "E2E Customer" } }),
      })
    );
  });

  // ===============================
  // E2E test 1
  // ===============================
  test("Happy Path: filling and submitting the form creates a ticket and shows the ticket number", async ({ page }) => {
    // Arrange
    let capturedRequestBody = null;
    await page.route("**/api/tickets", (route) => {
      capturedRequestBody = route.request().postDataJSON(); // SPY: inspect what the browser actually sent
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, ticket: { id: "t1", ticket_number: "TCK-0001", status: "New" } }), // STUB
      });
    });

    await page.goto("http://localhost:5173/pages/help/help.html");
    await page.waitForSelector("#ticketForm");

    // Act
    await page.fill("#subject", "Late order");
    await page.selectOption("#category", "delivery");
    await page.fill("#description", "Arrived two hours late");
    await page.click("#submitBtn");

    // Assert: UI reflects the server's response
    const notice = page.locator("#notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Ticket submitted successfully");
    await expect(notice).toContainText("TCK-0001");

    // Assert: the real request that left the browser had the right payload (closes the loop
    // from user action => network call, the E2E equivalent of the API test's body assertion)
    expect(capturedRequestBody).toMatchObject({
      category: "delivery",
      subject: "Late order",
      description: "Arrived two hours late",
    });
  });

  // ===============================
  // E2E test 2
  // ===============================
  test("Edge Case: ticket with missing category/description/subject will be blocked before any request is sent", async ({ page }) => {
    // Arrange
    let ticketRequestWasSent = false;
    await page.route("**/api/tickets", (route) => {
      ticketRequestWasSent = true; // SPY: if this ever flips true, the frontend guard failed
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, ticket: {} }) });
    });

    await page.goto("http://localhost:5173/pages/help/help.html");
    await page.waitForSelector("#ticketForm");

    // Act
    await page.fill("#subject", "   ");
    await page.fill("#description", "Description");
    await page.click("#submitBtn");

    // Assert: client-side validation notice, not a server response
    const notice = page.locator("#notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Please fill in Subject and Description.");

    // Assert: no network call was ever made for this submission
    expect(ticketRequestWasSent).toBe(false);
  });
});