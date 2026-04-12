# Design Document

## Overview

The order-location-map feature adds interactive map support to the existing Next.js POS/e-commerce application. It enables delivery location tracking for orders by:

1. Extending the `Order` Prisma model with `deliveryAddress`, `latitude`, and `longitude` fields.
2. Adding a `/api/orders/locations` API route for reading and updating location data.
3. Integrating optional geocoding (via a free geocoding API) when an address is provided without coordinates.
4. Embedding a reusable `OrderMap` React component (built on [Leaflet](https://leafletjs.com/) via `react-leaflet`) into the Orders page and all three role-based dashboards.

The map is role-scoped: admins and cashiers see all orders with location data; customers see only their own. The feature is purely additive — no existing functionality is broken.

---

## Architecture

```mermaid
flowchart TD
    subgraph Client
        A[Orders Page] --> C[OrderMap Component]
        B[Dashboard Pages\nadmin / cashier / customer] --> C
        C -->|fetch| D[/api/orders/locations]
    end

    subgraph Server
        D --> E[Auth Middleware\nverifyToken]
        E -->|admin/cashier| F[Return all orders with coords]
        E -->|customer| G[Return own orders with coords]
        E -->|unauthenticated| H[401 Unauthorized]
        I[/api/orders POST] --> J[Geocoding Service\nnominatim.openstreetmap.org]
        J -->|success| K[Persist lat/lng]
        J -->|failure| L[Persist address only, null coords]
    end

    subgraph Database
        M[(PostgreSQL\nOrder table\n+ deliveryAddress\n+ latitude\n+ longitude)]
    end

    D --> M
    I --> M
    K --> M
    L --> M
```

### Key Design Decisions

- **Leaflet / react-leaflet** — open-source, no API key required, well-supported in Next.js. Loaded dynamically (`next/dynamic` with `ssr: false`) to avoid SSR issues with browser-only Leaflet globals.
- **Nominatim geocoding** — free, no key required, suitable for low-volume usage. Geocoding is best-effort; failures are non-blocking.
- **Separate `/api/orders/locations` route** — keeps location concerns isolated from the existing orders route and avoids bloating the main orders payload with coordinate data.
- **Nullable coordinates** — orders without location data are valid; the map simply omits them.

---

## Components and Interfaces

### `OrderMap` Component

**Path:** `my-app/components/OrderMap.tsx`

A client-only, dynamically imported map component.

```typescript
type OrderPin = {
  id: number;
  status: string;
  deliveryAddress: string | null;
  latitude: number;
  longitude: number;
  customerUsername?: string; // present for admin/cashier view
};

type OrderMapProps = {
  pins: OrderPin[];
  loading?: boolean;
  height?: string; // e.g. "400px", defaults to "350px"
  linkToOrders?: boolean; // show "View all orders" link (for dashboard widgets)
};
```

Behaviour:
- Renders a Leaflet map centred on the mean of all pin coordinates (or a default centre if no pins).
- Each pin shows a marker; clicking opens a popup with order details.
- Shows a skeleton/spinner while `loading` is true.
- Shows an empty-state message when `pins` is empty and `loading` is false.

### `OrderMapWidget` Component

**Path:** `my-app/components/OrderMapWidget.tsx`

A thin wrapper around `OrderMap` used in dashboard pages. Fetches its own data from `/api/orders/locations` and renders `OrderMap` with `linkToOrders={true}`.

### `/api/orders/locations` Route

**Path:** `my-app/app/api/orders/locations/route.ts`

| Method | Auth | Behaviour |
|--------|------|-----------|
| GET | admin/cashier/customer | Returns orders with non-null lat/lng. Scope is role-based. |
| PATCH | admin/cashier only | Updates `deliveryAddress`, `latitude`, `longitude` on an order. |

**GET response shape:**
```typescript
type LocationItem = {
  id: number;
  status: string;
  deliveryAddress: string | null;
  latitude: number;
  longitude: number;
  customer: { username: string };
};
```

**PATCH request body:**
```typescript
type UpdateLocationBody = {
  id: number;
  deliveryAddress?: string;
  latitude?: number;
  longitude?: number;
};
```

### Geocoding Utility

**Path:** `my-app/lib/geocode.ts`

```typescript
type GeocodeResult = { lat: number; lng: number } | null;

async function geocodeAddress(address: string): Promise<GeocodeResult>
```

Uses the Nominatim OpenStreetMap API (`https://nominatim.openstreetmap.org/search`). Returns `null` on failure or empty results.

---

## Data Models

### Prisma Schema Changes

Add three fields to the `Order` model:

```prisma
model Order {
  id              Int         @id @default(autoincrement())
  customerId      Int
  status          String      @default("pending")
  totalAmount     Float
  dateTime        DateTime    @default(now())
  deliveryAddress String?
  latitude        Float?
  longitude       Float?
  customer        User        @relation(fields: [customerId], references: [id])
  items           OrderItem[]
}
```

A new Prisma migration will be generated to add these columns. All three fields are nullable so existing orders remain valid.

### Updated Order POST payload

The existing `POST /api/orders` handler is extended to accept an optional `deliveryAddress` field:

```typescript
type CreateOrderBody = {
  items: { productId: number; quantity: number; price: number }[];
  deliveryAddress?: string;
};
```

When `deliveryAddress` is provided, the handler calls `geocodeAddress()` and persists the result (or `null` on failure) alongside the address text.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Location API returns only geocoded orders

*For any* authenticated request to `GET /api/orders/locations`, every item in the response SHALL have a non-null `latitude` and a non-null `longitude`.

**Validates: Requirements 5.5**

### Property 2: Role-scoped location data — customer

*For any* authenticated customer request to `GET /api/orders/locations`, every returned order SHALL have a `customerId` equal to the authenticated customer's id.

**Validates: Requirements 5.3, 7.3**

### Property 3: Role-scoped location data — admin/cashier

*For any* authenticated admin or cashier request to `GET /api/orders/locations`, the response SHALL include all orders that have non-null coordinates, regardless of `customerId`.

**Validates: Requirements 5.2, 7.4**

### Property 4: PATCH updates are reflected in subsequent GET

*For any* valid order id and any valid latitude/longitude pair, after a successful PATCH to `/api/orders/locations`, a subsequent GET SHALL include that order with the updated coordinates.

**Validates: Requirements 6.2, 6.3**

### Property 5: Geocoding round-trip — address persisted with coordinates

*For any* order created with a non-empty `deliveryAddress` and no explicit coordinates, if geocoding succeeds, the stored `latitude` and `longitude` SHALL be non-null and the `deliveryAddress` SHALL equal the submitted address string.

**Validates: Requirements 1.4**

### Property 6: Geocoding failure — order still persisted

*For any* order created with a `deliveryAddress` that cannot be geocoded, the order SHALL be persisted with the `deliveryAddress` text intact and `latitude`/`longitude` set to `null`.

**Validates: Requirements 1.5**

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Unauthenticated request to `/api/orders/locations` | Return `401 Unauthorized` |
| Customer attempts PATCH on `/api/orders/locations` | Return `403 Forbidden` |
| PATCH with non-existent order id | Return `404 Not Found` |
| Geocoding service unavailable or returns no results | Log warning, persist order with `null` coordinates, include `geocodingFailed: true` in POST response |
| Map library fails to load (SSR / network) | `next/dynamic` with `loading` fallback renders a spinner; errors caught by React error boundary |
| Orders fetch fails on client | Show error state in `OrderMap` component |

---

## Testing Strategy

### Unit Tests

- `geocodeAddress()` utility: test with a valid address (mocked HTTP), empty result, and network error.
- `GET /api/orders/locations`: test role scoping (admin sees all, customer sees own, unauthenticated gets 401).
- `PATCH /api/orders/locations`: test successful update, 403 for customer, 404 for missing order.
- `POST /api/orders` with `deliveryAddress`: test geocoding success path and failure path.

### Property-Based Tests

Using [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native PBT library). Each property test runs a minimum of 100 iterations.

- **Property 1** — Generate random sets of orders with varying lat/lng nullability; assert GET response contains only non-null-coordinate orders.
  `Feature: order-location-map, Property 1: Location API returns only geocoded orders`

- **Property 2** — Generate random customer ids and order sets; assert every GET response item matches the requesting customer's id.
  `Feature: order-location-map, Property 2: Role-scoped location data — customer`

- **Property 3** — Generate random order sets with mixed customers; assert admin/cashier GET returns all geocoded orders.
  `Feature: order-location-map, Property 3: Role-scoped location data — admin/cashier`

- **Property 4** — Generate random valid lat/lng pairs; PATCH then GET and assert coordinates match.
  `Feature: order-location-map, Property 4: PATCH updates are reflected in subsequent GET`

- **Property 5** — Generate random address strings with mocked successful geocoder; assert stored order has non-null coords and matching address.
  `Feature: order-location-map, Property 5: Geocoding round-trip — address persisted with coordinates`

- **Property 6** — Generate random address strings with mocked failing geocoder; assert stored order has null coords and intact address.
  `Feature: order-location-map, Property 6: Geocoding failure — order still persisted`

### Integration Tests

- End-to-end: create an order with a real address, verify the map pin appears on the Orders page.
- Dashboard widgets: verify `OrderMapWidget` renders pins for the correct role scope.

### Snapshot / Visual Tests

- `OrderMap` with empty pins renders empty-state message.
- `OrderMap` with `loading={true}` renders spinner.
- `OrderMap` with sample pins renders correct number of markers.
