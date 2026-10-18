# Database Schema & Inventory Calculation Model

## 1. Relational Entities
- **`businesses`**: Root entity for multi-tenant isolation. Configures timezone and daily reporting cutoff time (default `21:00:00`).
- **`profiles`**: Application user profiles synchronized with Supabase `auth.users`.
- **`business_memberships`**: Defines role (`owner` or `employee`) per user per business.
- **`shops`**: Retail partner shops with unique code (e.g. `SH-01`), address, phone, and active status.
- **`shop_memberships`**: Associates employees with specific shops. One employee can be authorized for one or more shops.
- **`products`**: Accessories catalog (name, SKU, category, unit of measure, minimum stock threshold).
- **`deliveries`** & **`delivery_items`**: Morning or scheduled wholesale supplies from supplier to retail shop.
- **`daily_reports`** & **`daily_report_items`**: End-of-day sales submitted by store staff, including zero-sales declarations.
- **`stock_movements`**: Immutable append-only audit ledger recording every inventory addition or deduction.
- **`stock_counts`**: Periodic physical stock audits in stores, calculating variance against recorded balances.
- **`idempotency_records`**: Enforces strict at-most-once processing on critical transactional endpoints.

---

## 2. Inventory Calculation Model

The system separates stock into three clearly defined concepts to avoid presenting unverified estimates as audited truth:

```
[Total Wholesale Deliveries (DELIVERY_IN)]
               -
[Approved Sales Reports (SALE_OUT)]
               ±
[Authorized Audit Adjustments (AUDIT_ADJUSTMENT)]
               =
===============================================
       1. CONFIRMED RECORDED STOCK
===============================================
               -
[Provisional Sales (Unreviewed Daily Reports)]
               =
===============================================
       2. PROVISIONAL EXPECTED STOCK
===============================================

-----------------------------------------------
       3. PHYSICALLY COUNTED STOCK
(Direct manual in-store audit with variance tracking)
-----------------------------------------------
```

### Business Rules
1. **Append-Only Immutability**: No direct `UPDATE` or `DELETE` on `stock_movements`. Corrections must be written as compensating ledger entries (`AUDIT_ADJUSTMENT` or `RETURN_IN`/`RETURN_OUT`) with an authorized actor and reason.
2. **Zero-Sales Handling**: An explicit zero-sales submission records 0 quantity movement, fulfilling the shop's reporting obligation without corrupting inventory math.
3. **Negative Stock Prevention**: A sales report that exceeds available stock triggers an alert requiring explicit owner confirmation rather than silent negative ledger entries.
