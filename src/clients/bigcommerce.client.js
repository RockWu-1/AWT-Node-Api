const axios = require("axios");
const { createHttpError } = require("../utils/http-error");

function createBigcommerceClient({ storeHash, accessToken }) {
  return axios.create({
    baseURL: `https://api.bigcommerce.com/stores/${storeHash}/v2`,
    timeout: Number(process.env.BIGCOMMERCE_TIMEOUT_MS || 20000),
    headers: {
      "X-Auth-Token": accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

async function listOrders(client, { minDateModified, maxDateModified, customerId, page, limit }) {
  try {
    const params = {
      sort: "date_modified:asc",
      customer_id: customerId,
      limit,
      page,
    };

    if (minDateModified) {
      params.min_date_modified = minDateModified;
    }

    if (maxDateModified) {
      params.max_date_modified = maxDateModified;
    }

    const response = await client.get("/orders", { params });

    return response.data || [];
  } catch (error) {
    const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    throw createHttpError(502, `BigCommerce listOrders failed: ${detail}`);
  }
}

async function listOrderProducts(client, orderId) {
  try {
    const response = await client.get(`/orders/${orderId}/products`);
    return response.data || [];
  } catch (error) {
    const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    throw createHttpError(502, `BigCommerce listOrderProducts failed for order ${orderId}: ${detail}`);
  }
}

module.exports = {
  createBigcommerceClient,
  listOrders,
  listOrderProducts,
};