# Implementation Plan: Order Location Map

## Overview

Incrementally add delivery location tracking to the existing orders workflow. Each task builds on the previous: schema first, then geocoding utility, then the API route, then UI components, and finally wiring everything into the existing pages.

## Tasks

- [x] 1. Extend Prisma schema and run migration
  - Add `deliveryAddress String?`, `latitude Float?`, and `longitude Float?` fields to the `Order` model in `prisma/schema.prisma`
  - Run `prisma migrate dev --name add_order_location` to generate and apply the migration
  - Run `prisma generate` to update the Prisma client types
  - _Requirements: 1.2, 1.3_

- [ ] 2. Implement geocoding utility
  - [x] 2.1 Create `lib/geocode.ts` with `geocodeAddress(address: string): Promise<GeocodeResult>` using the Nominatim OpenStreetMap API (`https://nominatim.openstreetmap.org/search`)
    - Return `{ lat: number; lng: number }` on success, `null` on empty results or network error
    - Set a `User-Agent` header as required by Nominatim's usage policy
    - _Requirements: 1.4, 1.5_

  - [ ]* 2.2 Write property test for geocoding utility — Property 5 & 6
    - **Property 5: Geocoding round-trip — address persisted with coordinates**
    - **Property 6: Geocoding failure — order still persisted**
    - Use `fast-check` to generate random address strings; mock the HTTP call to simulate success and failure paths
    - Assert that on success the returned object has numeric `lat`/`lng`, and on failure the function returns `null`
    - **Validates: Requirements 1.4, 1.5**

- [ ] 3. Implement `/api/orders/locations` route
  - [x] 3.1 Create `app/api/orders/locations/route.ts` with a `GET` handler
    - Verify the JWT cookie with `verifyToken`; return `401` if unauthenticated
    - For `admin`/`cashier` roles return all orders where `latitude != null AND longitude != null`, including `id`, `status`, `deliveryAddress`, `latitude`, `longitude`, and `customer.username`
    - For `customer` role filter by `customerId === payload.id`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.3, 7.4_

  - [x] 3.2 Add `PATCH` handler to `app/api/orders/locations/route.ts`
    - Accept `{ id, deliveryAddress?, latitude?, longitude? }` in the request body
    - Return `403` for customer role, `404` if order id does not exist
    - Update the matching fields on the `Order` record and return the updated order
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.3 Write property test for GET — Property 1: Location API returns only geocoded orders
    - **Property 1: Location API returns only geocoded orders**
    - Use `fast-check` to generate sets of orders with varying `latitude`/`longitude` nullability; seed the mock DB and call the handler
    - Assert every item in the response has non-null `latitude` and `longitude`
    - **Validates: Requirements 5.5**

  - [ ]* 3.4 Write property test for GET — Property 2: Role-scoped data for customer
    - **Property 2: Role-scoped location data — customer**
    - Generate random customer ids and mixed-owner order sets; assert every returned order's `customerId` equals the requesting customer's id
    - **Validates: Requirements 5.3, 7.3**

  - [ ]* 3.5 Write property test for GET — Property 3: Role-scoped data for admin/cashier
    - **Property 3: Role-scoped location data — admin/cashier**
    - Generate random order sets with mixed customers; assert admin/cashier GET returns all geocoded orders regardless of `customerId`
    - **Validates: Requirements 5.2, 7.4**

  - [ ]* 3.6 Write property test for PATCH → GET round-trip — Property 4
    - **Property 4: PATCH updates are reflected in subsequent GET**
    - Generate random valid `latitude`/`longitude` pairs; PATCH then GET and assert the coordinates match
    - **Validates: Requirements 6.2, 6.3**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend `POST /api/orders` to accept `deliveryAddress`
  - Modify `app/api/orders/route.ts` `POST` handler to destructure `deliveryAddress` from the request body alongside `items`
  - If `deliveryAddress` is provided, call `geocodeAddress()` and include `deliveryAddress`, `latitude`, and `longitude` in the `prisma.order.create` data
  - If geocoding fails, persist the order with `deliveryAddress` set and `latitude`/`longitude` as `null`; include `geocodingFailed: true` in the `201` response
  - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [ ] 6. Build `OrderMap` component
  - [x] 6.1 Install `leaflet`, `react-leaflet`, `@types/leaflet` dependencies (add to `package.json` and run `npm install`)
    - _Requirements: 2.1, 3.1_

  - [x] 6.2 Create `components/OrderMap.tsx` as a client-only component loaded via `next/dynamic` with `ssr: false`
    - Accept `OrderMapProps`: `pins: OrderPin[]`, `loading?: boolean`, `height?: string`, `linkToOrders?: boolean`
    - Render a Leaflet `MapContainer` centred on the mean of all pin coordinates (fallback to a default centre when no pins)
    - Render a `Marker` for each pin; clicking opens a `Popup` showing order id, status, delivery address, and `customerUsername` when present
    - Show a spinner/skeleton while `loading` is `true`
    - Show an empty-state message ("No delivery locations available.") when `pins` is empty and `loading` is `false`
    - When `linkToOrders` is `true`, render a "View all orders →" link pointing to `/orders`
    - Import Leaflet CSS (`leaflet/dist/leaflet.css`) inside the component
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 7.1_

- [x] 7. Build `OrderMapWidget` component
  - Create `components/OrderMapWidget.tsx` as a client component
  - On mount, fetch `/api/orders/locations` and manage `pins` and `loading` state
  - Render `OrderMap` with the fetched pins, `loading` state, and `linkToOrders={true}`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8. Embed map into the Orders page and dashboard pages
  - [x] 8.1 Modify `app/orders/page.tsx` to dynamically import `OrderMap` and render it above the orders table
    - Fetch pins from `/api/orders/locations` alongside the existing orders fetch
    - Pass the fetched pins and loading state to `OrderMap`
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.4_

  - [x] 8.2 Modify `app/dashboard/admin/page.tsx` to import and render `OrderMapWidget` in the dashboard layout
    - Add the widget below the stat cards section
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 8.3 Modify `app/dashboard/cashier/page.tsx` to import and render `OrderMapWidget` in the dashboard layout
    - Add the widget below the stat cards section
    - _Requirements: 4.2, 4.4, 4.5_

  - [x] 8.4 Modify `app/dashboard/customer/page.tsx` to import and render `OrderMapWidget` in the dashboard layout
    - Add the widget below the stat cards section; the widget will automatically scope to the customer's own orders via the API
    - _Requirements: 4.3, 4.4, 4.5, 7.3_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `OrderMap` must be loaded with `next/dynamic` + `ssr: false` to avoid Leaflet SSR errors
- Nominatim geocoding is best-effort; failures are non-blocking and the order is always persisted
- Property tests use `fast-check` with mocked HTTP/DB calls — no real network or database required
