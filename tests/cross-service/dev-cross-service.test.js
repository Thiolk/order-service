const assert = require('assert');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const INGRESS_BASE_URL =
  process.env.INGRESS_BASE_URL || 'http://127.0.0.1:18080';
const ORDER_HOST = process.env.ORDER_HOST || 'order-dev.local';
const PRODUCT_HOST = process.env.PRODUCT_HOST || 'product-dev.local';

async function fetchViaIngress(host, path, options = {}) {
  const url = new URL(`${INGRESS_BASE_URL}${path}`);
  const client = url.protocol === 'https:' ? https : http;

  const headers = {
    Host: host,
    ...(options.headers || {}),
  };

  const bodyData = options.body || null;

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let raw = '';

        res.on('data', (chunk) => {
          raw += chunk;
        });

        res.on('end', () => {
          const contentType = res.headers['content-type'] || '';
          let body = raw;

          if (contentType.includes('application/json')) {
            try {
              body = JSON.parse(raw);
            } catch (err) {
              return reject(
                new Error(
                  `Failed to parse JSON response from ${host}${path}: ${raw}`,
                ),
              );
            }
          }

          resolve({ response: res, body });
        });
      },
    );

    req.on('error', reject);

    if (bodyData) {
      req.write(bodyData);
    }

    req.end();
  });
}

function getProductId(product) {
  return product?.id ?? product?.product_id ?? product?.productId;
}

function getProductPrice(product) {
  return Number(product?.price);
}

function getOrderId(order) {
  return order?.id;
}

function getOrderProductId(order) {
  return order?.product_id ?? order?.productId;
}

function getOrderQuantity(order) {
  return Number(order?.quantity);
}

function getOrderTotalPrice(order) {
  return Number(order?.total_price ?? order?.totalPrice);
}

function getOrderStatus(order) {
  return order?.status;
}

async function main() {
  console.log('========================================');
  console.log('Cross-service integration test (DEV)');
  console.log(`INGRESS_BASE_URL=${INGRESS_BASE_URL}`);
  console.log(`ORDER_HOST=${ORDER_HOST}`);
  console.log(`PRODUCT_HOST=${PRODUCT_HOST}`);
  console.log('========================================');

  console.log('\n[1/3] Fetching products from deployed product-service...');
  let selectedProduct;
  {
    const { response, body } = await fetchViaIngress(PRODUCT_HOST, '/products');

    assert.strictEqual(
      response.statusCode,
      200,
      `Expected GET /products to return 200, got ${response.statusCode}. Body: ${JSON.stringify(body)}`,
    );
    assert.ok(
      Array.isArray(body),
      'Expected GET /products response to be an array',
    );
    assert.ok(
      body.length > 0,
      'Expected at least one product in dev environment',
    );

    selectedProduct = body.find((product) => {
      const id = getProductId(product);
      const price = getProductPrice(product);
      return id !== undefined && Number.isFinite(price);
    });

    assert.ok(
      selectedProduct,
      'Could not find a usable product with id and numeric price from GET /products',
    );

    console.log('Selected product:', selectedProduct);
  }

  const productId = getProductId(selectedProduct);
  const productPrice = getProductPrice(selectedProduct);
  const quantity = 2;
  const expectedTotalPrice = productPrice * quantity;

  console.log('\n[2/3] Creating order through deployed order-service...');
  {
    const payload = { productId, quantity };

    const { response, body } = await fetchViaIngress(ORDER_HOST, '/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(
      response.statusCode,
      201,
      `Expected POST /orders to return 201, got ${response.statusCode}. Body: ${JSON.stringify(body)}`,
    );

    assert.ok(
      body && typeof body === 'object' && !Array.isArray(body),
      `Expected created order response to be an object. Got: ${JSON.stringify(body)}`,
    );

    const createdOrder = body;
    const createdOrderId = getOrderId(createdOrder);
    const createdProductId = getOrderProductId(createdOrder);
    const createdQuantity = getOrderQuantity(createdOrder);
    const createdTotalPrice = getOrderTotalPrice(createdOrder);
    const createdStatus = getOrderStatus(createdOrder);

    assert.ok(
      createdOrderId !== undefined,
      `Expected created order to have id. Body: ${JSON.stringify(createdOrder)}`,
    );
    assert.strictEqual(
      Number(createdProductId),
      Number(productId),
      `Expected created order product ID ${productId}, got ${createdProductId}`,
    );
    assert.strictEqual(
      createdQuantity,
      quantity,
      `Expected created order quantity ${quantity}, got ${createdQuantity}`,
    );
    assert.strictEqual(
      createdTotalPrice,
      expectedTotalPrice,
      `Expected total price ${expectedTotalPrice}, got ${createdTotalPrice}`,
    );
    assert.strictEqual(
      createdStatus,
      'pending',
      `Expected created order status "pending", got ${createdStatus}`,
    );

    console.log('Created order:', createdOrder);
  }

  console.log('\n[3/3] Cross-service happy path passed.');
  console.log(
    'Verified: external ingress -> order-service -> product-service -> database',
  );
}

main().catch((error) => {
  console.error('\nCross-service integration test FAILED');
  console.error(error);
  process.exit(1);
});
