// tests/api/menu.api.test.js 
// Part B: Integration test for GET /api/menu  / npm run test:api
// Verifies: HTTP status codes + response body structure
//
// Note: Supabase is still mocked here because we have no real DB/.env in the test environment, 
// this test spins up the actualExpress app and router together, and asserts on the full HTTP response
// (status + JSON shape) rather than inspecting internal function calls

jest.mock("../../backend/src/config/supabase.js", () => ({
  supabaseBase: { from: jest.fn() },
}));

const { supabaseBase } = require("../../backend/src/config/supabase.js");
const express = require("express");
const request = require("supertest");
const menuRouter = require("../../backend/src/modules/menu/menu.routes.js");

describe("Integration: GET /api/menu", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use("/api/menu", menuRouter);
  });

  test("Happy Path: returns 200 with correct response body structure", async () => {
    // Arrange
    const categoriesQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ id: "cat-1", category_name: "Noodles" }],
        error: null,
      }),
    };
    const itemsQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ id: "1", name: "Pho Bo", price: "12.50", category_name: "Noodles" }],
        error: null,
      }),
    };
    supabaseBase.from.mockImplementation((table) =>
      table === "menu_categories" ? categoriesQuery : itemsQuery
    );

    // Act
    const response = await request(app).get("/api/menu");

    // Assert - status code
    expect(response.status).toBe(200);

    // Assert - response body structure
    expect(response.body).toHaveProperty("categories");
    expect(response.body).toHaveProperty("items");
    expect(response.body).toHaveProperty("assets");
    expect(Array.isArray(response.body.categories)).toBe(true);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        name: expect.any(String),
        price: expect.any(Number),
        category: expect.any(String),
      })
    );
  });

  test("Edge Case: returns 500 with error message structure when DB fails", async () => {
    // Arrange
    const failingQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    };
    supabaseBase.from.mockReturnValue(failingQuery);

    // Act
    const response = await request(app).get("/api/menu");

    // Assert - status code
    expect(response.status).toBe(500);

    // Assert - response body structure
    expect(response.body).toEqual({ message: "DB error" });
  });
});