// tests/api/tickets.api.test.js
// Part B: Integration test for POST /tickets end point, /npm run test:api
// only mock the Supabase sing jest.mock, replace config/supabase.js with a fake version whose supabaseForRequest(),
// so can inject a fake authenticated user instead of needing a real login or a real database
// the real requireAuth middleware still runs, exercises the full HTTP path (real Express app: app.js + real router: tickets.routes.js + real middleware: requireAuth) end to end via Supertest

jest.mock("../../backend/src/config/supabase.js", () => ({
  supabaseForRequest: jest.fn(),
}));
jest.mock("../../backend/src/config/supabaseAdmin.js", () => ({
  supabaseAdmin: { from: jest.fn() },
}));
// Grab the now-mocked function so each test can call .mockReturnValue(...) on it directly
const { supabaseForRequest } = require("../../backend/src/config/supabase.js");
const express = require("express");
const request = require("supertest");
// The REAL router, unmodified; this is the actual production code under test
const ticketsRouter = require("../../backend/src/modules/tickets/tickets.routes.js");
// Fake Supabase query-builder chain, the same way real Supabase queries are (.select().eq()...)
function defaultChain(overrides = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}
// Builds the fake, request-scoped Supabase client that supabaseForRequest() will hand back
// .auth.getUser() is what the real requireAuth middleware calls to "log the user in", resolving
// it with `user` simulates a successful login without a real JWT or Supabase network call.
// .from(table) is what the handler itself calls (req.sb.from("profiles"), .from("tickets"))
// tableChains lets a test wire a specific table to a specific chain; anything not listed falls back to a harmless defaultChain()
function buildAuthedClient(user, tableChains = {}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: jest.fn((table) => tableChains[table] || defaultChain()),
  };
}
// One fake logged-in customer, reused across tests so each test only has to name what's different about it (which table chain, which request body)
const CUSTOMER_A = {
  id: "customer-001",
  email: "customer001@example.com",
  role: "customer",
};

describe("Integration: POST /tickets", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/tickets", ticketsRouter); // mount the REAL router, untouched
  });

  // ===============================
  // API test 1
  // ===============================
  test("Happy Path: returns 201 with the created ticket, correct body shape and JSON header", async () => {
    // Arrange
    const insertedRow = { id: "t1", ticket_number: "TCK-0001", status: "New" };
    const ticketsChain = defaultChain({
      single: jest.fn().mockResolvedValue({ data: insertedRow, error: null }), // STUB: canned insert result
    });
    // MOCK: fake Supabase client stands in for real network/DB, wired for this one request
    supabaseForRequest.mockReturnValue({
      token: "fake-jwt",
      client: buildAuthedClient(CUSTOMER_A, { tickets: ticketsChain }),
    });

    // Act: real HTTP request through supertest, hitting the real Express app + router
    const response = await request(app)
      .post("/tickets")
      .set("Authorization", "Bearer fake-jwt")
      .send({
        category: "delivery",
        subject: "Late order",
        description: "Arrived two hours late",
      });

    // Assert
    expect(response.status).toBe(201); // Assert: status code
    expect(response.body).toEqual({ success: true, ticket: insertedRow }); // Assert: response body structure
    expect(response.headers["content-type"]).toMatch(/application\/json/); // Assert: response header (demonstrates verifying status + body + headers together)

    // SPY: confirm the handler actually queried the "tickets" table, not just returned 201 by luck
    expect(ticketsChain.insert).toHaveBeenCalledTimes(1);
  });

  // ===============================
  // API test 2
  // ===============================
  test("Edge Case: missing category/subject/description returns 400 with a message", async () => {
    // Arrange
    supabaseForRequest.mockReturnValue({
      token: "fake-jwt",
      client: buildAuthedClient(CUSTOMER_A), // MOCK: no table chain needed, handler returns before touching any table
    });

    // Act
    const response = await request(app)
      .post("/tickets")
      .set("Authorization", "Bearer fake-jwt")
      .send({ subject: "Late order" }); // category + description missing

    // Assert
    expect(response.status).toBe(400); // Assert: status code, the contrasting failure code
    expect(response.body).toEqual({ message: "category, subject, description are required" }); // Assert: response body structure
  });
});