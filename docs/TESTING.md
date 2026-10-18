# Automated Testing & Verification Guide

## 1. Test Suite Overview
The project maintains a multi-tiered test suite:
- **Unit Tests**: Schema validation, business logic, inventory calculation models, idempotency rules.
- **API Tests (Supertest + Vitest)**: Endpoint routing, input validation, HTTP security headers, error handling.
- **Database Security Tests (PostgreSQL RLS)**: Allow-and-deny verification for owner, assigned employee, unassigned employee, and anonymous access.

## 2. Running Tests
Run all workspace tests:
```bash
npm test
```

Run shared package tests only:
```bash
npm run test --workspace=@crimpston/shared
```

Run API tests only:
```bash
npm run test --workspace=@crimpston/api
```

Run Web tests only:
```bash
npm run test --workspace=@crimpston/web
```

## 3. Database Security Policy Verification Scenarios
| Scenario | Subject | Target Resource | Expected Outcome |
|---|---|---|---|
| SEC-TEST-1 | Anonymous User | `products`, `deliveries`, `daily_reports` | **DENIED** (0 rows returned / 401 Unauthorized) |
| SEC-TEST-2 | Business Owner | All business shops, deliveries, and reports | **ALLOWED** |
| SEC-TEST-3 | Employee assigned to Store 1 | Store 1 daily reports & deliveries | **ALLOWED** |
| SEC-TEST-4 | Employee assigned to Store 1 | Store 2 daily reports & deliveries | **DENIED** (Row Level Security filtering) |
| SEC-TEST-5 | Employee | Direct `UPDATE` or `DELETE` on `stock_movements` | **DENIED** (Immutable ledger policy) |
| SEC-TEST-6 | Employee | Promotion of own role in `business_memberships` | **DENIED** (Only owners can manage memberships) |
