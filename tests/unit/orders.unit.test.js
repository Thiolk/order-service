const request = require("supertest");

// Mock axios BEFORE requiring the app
jest.mock("axios", () => ({
  get: jest.fn(),
}));

// Mock pg Pool BEFORE requiring the app
const mockQuery = jest.fn();
jest.mock("pg", () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
  })),
}));

const axios = require("axios");
const { index } = require("../../src/index.js");

describe("Order Service - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /health returns 200 OK", async () => {
    const res = await request(index).get("/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("OK");
  });

  test("GET /orders returns rows from DB", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, product_id: 10, quantity: 2, total_price: 20, status: "pending" },
      ],
    });

    const res = await request(index).get("/orders");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 1, product_id: 10, quantity: 2, total_price: 20, status: "pending" },
    ]);

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );
  });

  test("POST /orders creates an order when product exists", async () => {
    axios.get.mockResolvedValueOnce({
      data: { id: 10, price: 5 },
    });

    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 123, product_id: 10, quantity: 3, total_price: 15, status: "pending" },
      ],
    });

    const res = await request(index)
      .post("/orders")
      .send({ productId: 10, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 123,
      product_id: 10,
      quantity: 3,
      total_price: 15,
      status: "pending",
    });

    expect(axios.get).toHaveBeenCalledWith(
      "http://product-service:3001/products/10"
    );

    expect(mockQuery).toHaveBeenCalledWith(
      "INSERT INTO orders (product_id, quantity, total_price, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [10, 3, 15, "pending"]
    );
  });

  test("POST /orders returns 404 when product service returns 404", async () => {
    axios.get.mockRejectedValueOnce({
      response: { status: 404 },
    });

    const res = await request(index)
      .post("/orders")
      .send({ productId: 999, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Product not found" });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  test("PATCH /orders/:id returns 404 when order not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(index)
      .patch("/orders/999")
      .send({ status: "shipped" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Order not found" });

    expect(mockQuery).toHaveBeenCalledWith(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      ["shipped", "999"]
    );
  });
});