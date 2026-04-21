const { createBigcommerceClient, listOrders, listOrderProducts } = require("../clients/bigcommerce.client");
const { createHttpError } = require("../utils/http-error");

const ORDER_PAGE_LIMIT = 250;
const PRODUCT_FETCH_CONCURRENCY = Number(process.env.BIGCOMMERCE_PRODUCT_FETCH_CONCURRENCY || 8);

function toUtcIsoString(date) {
  return new Date(date).toISOString().replace(".000", "");
}

function getLastThirtyDaysUtcRange() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  return {
    minDateModified: toUtcIsoString(thirtyDaysAgo),
    maxDateModified: toUtcIsoString(now),
  };
}

function normalizeSizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function extractItemSize(productLine) {
  const options = Array.isArray(productLine.product_options) ? productLine.product_options : [];

  for (const option of options) {
    const name = normalizeSizeValue(option.display_name || option.name || option.option_name);
    if (name === "size") {
      return normalizeSizeValue(option.display_value || option.value || option.option_value);
    }
  }

  return "";
}

function validateAndNormalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Request body is required.");
  }

  const customerId = Number(payload.customerId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw createHttpError(400, "customerId must be a positive integer.");
  }

  if (!Array.isArray(payload.productIds) || payload.productIds.length === 0) {
    throw createHttpError(400, "productIds must be a non-empty array.");
  }

  const productIds = [...new Set(payload.productIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

  if (productIds.length === 0) {
    throw createHttpError(400, "productIds must contain valid positive integers.");
  }

  if (payload.size !== undefined && !Array.isArray(payload.size)) {
    throw createHttpError(400, "size must be an array when provided.");
  }

  const rawSizes = Array.isArray(payload.size) ? payload.size : [];
  const sizeSet = new Set(rawSizes.map((s) => normalizeSizeValue(s)).filter(Boolean));

  return {
    customerId,
    productIds,
    sizeSet,
  };
}

function validateAndNormalizeBigcommerceAuth(auth) {
  if (!auth || typeof auth !== "object") {
    throw createHttpError(400, "BigCommerce auth headers are required.");
  }

  const storeHash = String(auth.storeHash || "").trim();
  const accessToken = String(auth.accessToken || "").trim();

  if (!storeHash) {
    throw createHttpError(400, "Missing BigCommerce storeHash in request headers.");
  }

  if (!accessToken) {
    throw createHttpError(400, "Missing BigCommerce accessToken in request headers.");
  }

  return { storeHash, accessToken };
}

async function hasCustomerHistoricalOrders(client, customerId) {
  const firstPage = await listOrders(client, {
    customerId,
    page: 1,
    limit: 1,
  });

  return firstPage.length > 0;
}

async function fetchOrdersInRange(client, minDateModified, maxDateModified, customerId) {
  const allOrders = [];
  let page = 1;

  while (true) {
    const pageOrders = await listOrders(client, {
      minDateModified,
      maxDateModified,
      customerId,
      page,
      limit: ORDER_PAGE_LIMIT,
    });

    allOrders.push(...pageOrders);

    if (pageOrders.length < ORDER_PAGE_LIMIT) {
      break;
    }

    page += 1;
  }

  return allOrders;
}

function buildAggregateKey(productId, variantId, sku, size) {
  return `${productId}::${variantId || 0}::${sku || ""}::${size}`;
}

async function fetchProductsByOrders(client, orders) {
  const orderProducts = [];

  for (let i = 0; i < orders.length; i += PRODUCT_FETCH_CONCURRENCY) {
    const chunk = orders.slice(i, i + PRODUCT_FETCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (order) => {
        const products = await listOrderProducts(client, order.id);
        return {
          orderId: order.id,
          products,
        };
      })
    );
    orderProducts.push(...chunkResults);
  }

  return orderProducts;
}

async function getItemAllocation(payload, auth) {
  const { customerId, productIds, sizeSet } = validateAndNormalizePayload(payload);
  const { storeHash, accessToken } = validateAndNormalizeBigcommerceAuth(auth);
  const client = createBigcommerceClient({ storeHash, accessToken });

  const hasHistoricalOrders = await hasCustomerHistoricalOrders(client, customerId);
  if (!hasHistoricalOrders) {
    return {
      isNewCustomer: true,
    };
  }

  const productIdSet = new Set(productIds);
  const { minDateModified, maxDateModified } = getLastThirtyDaysUtcRange();
  const orders = await fetchOrdersInRange(client, minDateModified, maxDateModified, customerId);

  if (orders.length === 0) {
    return [];
  }

  const orderProducts = await fetchProductsByOrders(client, orders);
  const aggregate = new Map();

  for (const { products } of orderProducts) {
    for (const line of products) {
      const productId = Number(line.product_id);
      const matchesProduct = productIdSet.has(productId);
      const shouldUseSizeFilter = sizeSet.size > 0;
      const lineSize = shouldUseSizeFilter ? extractItemSize(line) : "";
      const matchesSize = shouldUseSizeFilter && !!lineSize && sizeSet.has(lineSize);

      if (!matchesProduct && !matchesSize) {
        continue;
      }

      const quantity = Number(line.quantity || 0);
      if (!quantity) {
        continue;
      }

      const variantId = Number(line.variant_id || 0);
      const sku = line.sku || "";
      const key = buildAggregateKey(productId, variantId, sku, lineSize);

      if (!aggregate.has(key)) {
        aggregate.set(key, {
          product_Id: productId,
          variant_Id: variantId,
          sku,
          size: lineSize,
          purchased_quantity: 0,
        });
      }

      const current = aggregate.get(key);
      current.purchased_quantity += quantity;
    }
  }

  return Array.from(aggregate.values());
}

module.exports = {
  getItemAllocation,
};