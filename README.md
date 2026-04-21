# AWT Node API

## Run

1. Install dependencies

```bash
npm install
```

2. Configure env

```bash
cp .env.example .env
```

3. Start service

```bash
npm start
```

## CORS

- `CORS_ORIGINS` uses comma-separated origins.
- Example: `CORS_ORIGINS=http://localhost:3000,https://your-frontend.com`
- If `CORS_ORIGINS` is empty, all origins are allowed (good for quick testing, not recommended for production).

## API

### `POST /api/getItemAllocation`

Required request headers:

- `store_hash`: BigCommerce store hash
- `token`: BigCommerce access token

Request body:

```json
{
  "customerId": 123,
  "productIds": [3372, 7885],
  "size": ["Small", "Medium"]
}
```

Behavior:

- Query BigCommerce orders in the last 30 days (UTC), from now-30d to now.
- Query orders by `customer_id` directly.
- Fetch each order's products.
- Aggregate purchased quantity by `product_id + variant_id + sku + size`.
- Compare `size` in lowercase.

Response format:

```json
{
  "status": 200,
  "message": "ok",
  "data": [
    {
      "product_Id": 7885,
      "variant_Id": 830315,
      "sku": "CRN-CR3266",
      "size": "small",
      "purchased_quantity": 51
    }
  ]
}
```