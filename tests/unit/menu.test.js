// tests/unit/menu.test.js    
// Part A: Unit test for menu.routes.js / npm run test:unit

// MOCK: replace the real Supabase config before menu.routes.js loads it
jest.mock("../../backend/src/config/supabase.js", () => ({
  supabaseBase: { from: jest.fn() },
}));

// Get the mocked Supabase client so we can control and inspect it
const { supabaseBase } = require("../../backend/src/config/supabase.js");
const express = require("express");
const request = require("supertest");
// Load menu.routes AFTER the Supabase dependency has been mocked
const menuRouter = require("../../backend/src/modules/menu/menu.routes.js");
// mapMenuItems is exposed by menu.routes.js for unit testing
const { mapMenuItems } = menuRouter;

// PURE BUSINESS LOGIC
describe("mapMenuItems (pure logic)", () => {
    // ===============================
    // unit test 1
    // ===============================
  test("Happy Path: maps items and converts price to Number", () => {
    // Arrange
    const items = [{ id: "1", name: "Pho Bo", price: "12.50", category_name: "Noodles" }];

    // Act
    const result = mapMenuItems(items);

    // Assert
    expect(result[0].price).toBe(12.5);
    expect(result[0].category).toBe("Noodles");
  });

  // ===============================
  // unit test 2
  // ===============================
  test("Edge Case: returns empty array when items is null", () => {
    // Arrange
    const items = null;

    // Act
    const result = mapMenuItems(items);

    // Assert
    expect(result).toEqual([]);
  });
});

// TEST USING MOCK + STUB + SPY
describe("GET /api/menu", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();  // Clear previous mock calls between tests
    app = express();  // Create a small Express application just for testing
    app.use("/api/menu", menuRouter);  // Mount the actual menu router
  });

  // ===============================
  // unit test 3
  // ===============================
  test("Happy Path: returns categories and mapped items", async () => {
    // Arrange
    // STUB: fixed fake data standing in for real DB rows
    const stubbedCategories = [{ id: "cat-1", category_name: "Noodles" }];
    const stubbedItems = [{ id: "1", name: "Pho Bo", price: "12.50", category_name: "Noodles" }];

    // STUB: Fake Supabase query for menu_categories
    const categoriesQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: stubbedCategories, error: null }),
    };
    //STUB: Fake Supabase query for menu_items
    const itemsQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: stubbedItems, error: null }),
    };

    // MOCK: fake Supabase client swapped in for the real network dependency
    supabaseBase.from.mockImplementation((table) =>
      table === "menu_categories" ? categoriesQuery : itemsQuery
    );

    // Act
    const response = await request(app).get("/api/menu");  // Call the real Express route

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual(stubbedCategories);
    expect(response.body.items[0].price).toBe(12.5);

    // SPY: verify how the dependency was called, not just the result. Verify the route queried the correct tables
    expect(supabaseBase.from).toHaveBeenCalledWith("menu_categories");
    expect(supabaseBase.from).toHaveBeenCalledWith("menu_items");
  });

  // ===============================
  // unit test 4
  // ===============================
  test("Edge Case: returns 500 when categories query fails", async () => {
    // Arrange
    // Simulate Supabase returning an error
    const failingQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    };
    // MOCK: Return the failed categories query
    supabaseBase.from.mockReturnValue(failingQuery);

    // Act
    const response = await request(app).get("/api/menu");

    // Assert
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("DB error");

    // SPY: with Promise.all, both queries fire concurrently 
    // menu_items IS queried even though categories fails, since the failure isn't known until both promises resolve
    expect(supabaseBase.from).toHaveBeenCalledTimes(2);
  });
});