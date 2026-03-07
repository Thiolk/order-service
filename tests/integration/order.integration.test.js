const request = require('supertest');
const axios = require('axios');
const { Pool } = require('pg');

jest.mock('axios');
jest.mock('pg', () => {
  const queryMock = jest.fn();

  return {
    Pool: jest.fn(() => ({
      query: queryMock,
    })),
    __queryMock: queryMock,
  };
});

const { __queryMock } = require('pg');
const { index } = require('../../src/index');

describe('order-service service-local integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __queryMock.mockReset();
  });

  describe('GET /health', () => {
    test('returns 200 with OK body', async () => {
      const res = await request(index).get('/health');

      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
    });
  });

  describe('POST /orders', () => {
    test('creates an order successfully', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          id: 7,
          name: 'Mouse',
          price: 29.99,
        },
      });

      __queryMock.mockResolvedValueOnce({
        rows: [
          {
            id: 101,
            product_id: 7,
            quantity: 2,
            total_price: 59.98,
            status: 'pending',
          },
        ],
      });

      const res = await request(index).post('/orders').send({
        productId: 7,
        quantity: 2,
      });

      expect(res.status).toBe(201);

      expect(axios.get).toHaveBeenCalledWith(
        'http://product-service:3001/products/7',
      );

      expect(__queryMock).toHaveBeenCalledWith(
        'INSERT INTO orders (product_id, quantity, total_price, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [7, 2, 59.98, 'pending'],
      );

      expect(res.body).toEqual({
        id: 101,
        product_id: 7,
        quantity: 2,
        total_price: 59.98,
        status: 'pending',
      });
    });

    test('returns 404 when product service says product does not exist', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 404,
        },
      });

      const res = await request(index).post('/orders').send({
        productId: 999,
        quantity: 1,
      });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Product not found' });

      expect(__queryMock).not.toHaveBeenCalled();
    });

    test('returns 500 when database insert fails', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          id: 3,
          name: 'Keyboard',
          price: 49.99,
        },
      });

      __queryMock.mockRejectedValueOnce(new Error('database failure'));

      const res = await request(index).post('/orders').send({
        productId: 3,
        quantity: 1,
      });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Error creating order' });
    });
  });
});
