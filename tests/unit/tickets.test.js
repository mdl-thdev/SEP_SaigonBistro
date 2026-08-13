// tests/unit/tickets.test.js
// Part A: Unit test for tickets.test.js / npm run test:unit
// tickets.routes.js row 19-78: arrow function async (req, res) => {...} => handler
// The handler is pulled directly out of Express's own router stack and invoked with no HTTP layer, no browser => req.sb (Supabase) is fully mocked
// middlewares/auth.js, utils/constants.js, and config/supabaseAdmin.js are real modules that already exist in this repo => mocked here only to isolate the handler under test

jest.mock("../../backend/src/middlewares/auth.js", () => ({
  requireAuth: (req, res, next) =>
    req.user
      ? next()
      : res.status(401).json({ message: "Authentication required" }),
  requireStaffOrAdmin: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));
jest.mock("../../backend/src/utils/constants.js", () => ({
  TICKET_STATUSES: new Set(["New"]),
}));
jest.mock("../../backend/src/config/supabaseAdmin.js", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const ticketsRouter = require("../../backend/src/modules/tickets/tickets.routes.js");

// ---- inline helpers ----
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
function buildSb(tableChains = {}) {
  return { from: jest.fn((table) => tableChains[table] || defaultChain()) };
}
function getHandler(method, path) {
  const layer = ticketsRouter.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`No ${method.toUpperCase()} handler found for ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle; // last = real handler, after middleware
}
function fakeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res); // SPY
  res.json = jest.fn().mockReturnValue(res); // SPY
  return res;
}

const postHandler = getHandler("post", "/");
const CUSTOMER_A = { id: "customer-001", email: "customer001@example.com", role: "customer" };
const STAFF_USER = { id: "staff-001", email: "staff001@example.com", role: "staff" };

describe("POST / tickets", () => {
  // ===============================
  // Unit test 1
  // =================================
  test("Happy Path: valid ticket reaches the insert with the right payload and returns 201", async () => {
    // Arrange
    const insertedRow = { id: "T001", ticket_number: "TCK-0001", status: "New" };
    const ticketsChain = defaultChain({
      single: jest.fn().mockResolvedValue({ data: insertedRow, error: null }), // STUB: the "tickets" table's .single() is stubbed to resolve with a canned inserted row
    });
    const sb = buildSb({ tickets: ticketsChain }); // MOCK: fake Supabase client, isolates the handler from any real DB/API
    const req = {
      user: CUSTOMER_A,
      sb,
      body: { category: "Delivery", subject: "Late order", description: "Arrived two hours late" },
    };
    const res = fakeRes();

    // Act
    await postHandler(req, res);

    // Assert: response
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, ticket: insertedRow });

    // SPY: confirm the handler talked to the right table with the right shape
    expect(sb.from).toHaveBeenCalledWith("tickets");
    expect(ticketsChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        customer_id: CUSTOMER_A.id,
        category: "Delivery",
        subject: "Late order",
        description: "Arrived two hours late",
        status: "New",
      }),
    ]);
  });

  // ===============================
  // Unit test 2
  // ===============================
  test("Edge Case: a whitespace-only subject is NOT rejected and still returns 201", async () => {
    // Arrange
    const ticketsChain = defaultChain({
      single: jest.fn().mockResolvedValue({ data: { id: "t2" }, error: null }), // STUB: canned success response
    });
    const sb = buildSb({ tickets: ticketsChain }); // MOCK: isolates handler from real DB
    const req = {
      user: CUSTOMER_A,
      sb,
      body: { category: "Delivery", subject: "   ", description: "Description" },
    };
    const res = fakeRes();

    // Act
    await postHandler(req, res);

    // Assert: freezes today's real behavior; this is a tracked defect, not a fix
    expect(res.status).toHaveBeenCalledWith(201);

    // SPY: prove the untrimmed whitespace subject is exactly what got persisted
    expect(ticketsChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ subject: "   " }),
    ]);
  });

  // ===============================
  // Unit test 3
  // ===============================
  test("Edge Case: a staff-role user is not blocked from creating a ticket", async () => {
    // Arrange
    const ticketsChain = defaultChain({
      single: jest.fn().mockResolvedValue({ data: { id: "t3" }, error: null }), // STUB: canned success response
    });
    const sb = buildSb({ tickets: ticketsChain }); // MOCK: isolates handler from real DB
    const req = {
      user: STAFF_USER,
      sb,
      body: { category: "Delivery", subject: "Staff-created", description: "Description" },
    };
    const res = fakeRes();

    // Act
    await postHandler(req, res);

    // Assert: only requireAuth guards this route; no role check exists yet
    expect(res.status).toHaveBeenCalledWith(201);

    // SPY: the staff user's own id was stored as the ticket's customer_id
    expect(ticketsChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ customer_id: STAFF_USER.id }),
    ]);
  });
});