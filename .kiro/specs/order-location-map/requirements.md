# Requirements Document

## Introduction

This feature adds an interactive map to the existing orders workflow of a Next.js POS/e-commerce application. The map allows tracking of delivery locations associated with orders. It is accessible from three role-based dashboards — admin, cashier, and customer — with each role seeing an appropriate scope of order location data. The feature requires storing a delivery address or coordinates on each order and rendering them on an embedded map component.

## Glossary

- **Map_Component**: The interactive map UI element rendered using a third-party mapping library (e.g., Leaflet or Google Maps).
- **Order_Location**: A geographic coordinate (latitude and longitude) and/or a human-readable delivery address associated with an order.
- **Location_API**: The Next.js API route responsible for reading and writing order location data.
- **Orders_Page**: The shared `/orders` page accessible by admin, cashier, and customer roles.
- **Admin**: A user with the `admin` role who can view all orders and their locations.
- **Cashier**: A user with the `cashier` role who can view all orders and their locations.
- **Customer**: A user with the `customer` role who can only view their own orders and locations.
- **Geocoder**: A service that converts a human-readable address into geographic coordinates.
- **Map_View**: The full-page or panel view that displays order pins on the Map_Component.
- **Order_Pin**: A map marker representing the delivery location of a single order.

---

## Requirements

### Requirement 1: Store Order Delivery Location

**User Story:** As a customer, I want to provide a delivery address when placing an order, so that the store knows where to deliver my items.

#### Acceptance Criteria

1. WHEN a customer submits an order, THE Orders_Page SHALL accept an optional delivery address string as part of the order payload.
2. THE Location_API SHALL store the delivery address as a text field on the Order record in the database.
3. THE Location_API SHALL store the latitude and longitude as nullable decimal fields on the Order record in the database.
4. IF a delivery address is provided but coordinates are absent, THEN THE Location_API SHALL attempt to geocode the address and persist the resulting latitude and longitude.
5. IF geocoding fails, THEN THE Location_API SHALL persist the order with the address text and null coordinates, and SHALL return a response indicating the geocoding failure.

---

### Requirement 2: Display Order Location Map — Admin and Cashier

**User Story:** As an admin or cashier, I want to see all orders plotted on a map, so that I can monitor delivery locations across all customers.

#### Acceptance Criteria

1. WHEN an admin or cashier navigates to the Orders_Page, THE Orders_Page SHALL display a Map_Component showing Order_Pins for all orders that have a non-null latitude and longitude.
2. THE Map_Component SHALL render each Order_Pin at the coordinates stored on the corresponding Order record.
3. WHEN an admin or cashier clicks an Order_Pin, THE Map_Component SHALL display a popup containing the order ID, customer username, order status, and delivery address.
4. WHILE the orders data is loading, THE Map_Component SHALL display a loading indicator in place of the map.
5. IF no orders have location data, THEN THE Map_Component SHALL display an empty-state message indicating no locations are available.

---

### Requirement 3: Display Order Location Map — Customer

**User Story:** As a customer, I want to see my own orders on a map, so that I can track where my deliveries are headed.

#### Acceptance Criteria

1. WHEN a customer navigates to the Orders_Page, THE Orders_Page SHALL display a Map_Component showing Order_Pins only for orders belonging to the authenticated customer.
2. THE Map_Component SHALL render each Order_Pin at the coordinates stored on the corresponding Order record.
3. WHEN a customer clicks an Order_Pin, THE Map_Component SHALL display a popup containing the order ID, order status, and delivery address.
4. IF the customer has no orders with location data, THEN THE Map_Component SHALL display an empty-state message indicating no locations are available.

---

### Requirement 4: Map Integration in Dashboard Widgets

**User Story:** As an admin, cashier, or customer, I want a map preview on my dashboard, so that I can quickly see order locations without navigating away.

#### Acceptance Criteria

1. WHEN an admin views the admin dashboard, THE Admin_Dashboard SHALL display a Map_Component widget showing Order_Pins for all orders with location data.
2. WHEN a cashier views the cashier dashboard, THE Cashier_Dashboard SHALL display a Map_Component widget showing Order_Pins for all orders with location data.
3. WHEN a customer views the customer dashboard, THE Customer_Dashboard SHALL display a Map_Component widget showing Order_Pins only for the authenticated customer's orders with location data.
4. THE Map_Component widget on each dashboard SHALL include a link to the full Orders_Page map view.
5. IF no orders have location data, THEN THE Map_Component widget SHALL display an empty-state message.

---

### Requirement 5: Location API — Read Endpoint

**User Story:** As a developer, I want a dedicated API endpoint to retrieve order location data, so that the Map_Component can fetch coordinates efficiently.

#### Acceptance Criteria

1. THE Location_API SHALL expose a GET endpoint at `/api/orders/locations` that returns a list of orders with their id, status, delivery address, latitude, and longitude.
2. WHEN a request is made by an admin or cashier, THE Location_API SHALL return location data for all orders.
3. WHEN a request is made by a customer, THE Location_API SHALL return location data only for orders belonging to that customer.
4. IF the request is made by an unauthenticated user, THEN THE Location_API SHALL return a 401 Unauthorized response.
5. THE Location_API SHALL exclude orders with null latitude or null longitude from the response.

---

### Requirement 6: Location API — Update Endpoint

**User Story:** As an admin or cashier, I want to update the delivery location of an order, so that I can correct or add location data after an order is placed.

#### Acceptance Criteria

1. THE Location_API SHALL expose a PATCH endpoint at `/api/orders/locations` that accepts an order id, an optional delivery address, and optional latitude and longitude values.
2. WHEN an admin or cashier submits a PATCH request with a valid order id and address, THE Location_API SHALL update the delivery address on the Order record.
3. WHEN an admin or cashier submits a PATCH request with valid latitude and longitude values, THE Location_API SHALL update the coordinates on the Order record.
4. IF the request is made by a customer, THEN THE Location_API SHALL return a 403 Forbidden response.
5. IF the provided order id does not exist, THEN THE Location_API SHALL return a 404 Not Found response.

---

### Requirement 7: Role-Based Access Control for Map Feature

**User Story:** As a system owner, I want map access to be governed by the existing role-based access control, so that users only see data they are authorized to view.

#### Acceptance Criteria

1. THE Map_Component SHALL only render when the authenticated user has the role of `admin`, `cashier`, or `customer`.
2. IF an unauthenticated user attempts to access a page containing the Map_Component, THEN THE Orders_Page SHALL redirect the user to the login page.
3. WHILE a customer is authenticated, THE Map_Component SHALL only display Order_Pins for orders where the `customerId` matches the authenticated customer's id.
4. WHILE an admin or cashier is authenticated, THE Map_Component SHALL display Order_Pins for all orders regardless of `customerId`.
