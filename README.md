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

### `POST /getItemAllocation`

Request body:

```json
{
  "customerId": 123,
  "productIds": [3372, 7885],
  "size": ["Small", "Medium"]
}
```

Behavior:

- Query BigCommerce orders in previous natural month (UTC), i.e. from previous month start 00:00:00Z to current month start 00:00:00Z.
- Filter by `customerId`.
- Fetch each order's products.
- Aggregate purchased quantity by `product_id + variant_id + sku + size`.
- Compare `size` in lowercase.

Response format:

```json
[
  {
    "product_Id": 7885,
    "variant_Id": 830315,
    "sku": "CRN-CR3266",
    "size": "small",
    "purchased_quantity": 51
  }
]
```