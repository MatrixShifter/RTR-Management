# RTR Wholesale Management — Database Integrity & Data Safety Report

**Date:** 2026-11-03  
**Status:** Integrity Verified  
**Target Project:** `https://xjlnoxbkcyymtdtallzu.supabase.co` (`xjlnoxbkcyymtdtallzu`)

---

## 1. Schema & Table Architecture

The production database schema consists of 19 relational tables designed with strict referential integrity, foreign key cascading guards, indexes, check constraints, and Row Level Security (RLS) policies:

| Table Name | Primary Key | Foreign Keys & Relationships | Key Constraints & Invariants | RLS Status |
| :--- | :--- | :--- | :--- | :--- |
| `businesses` | `id` (UUID) | None (Tenant Root) | `is_active` boolean | Enabled |
| `profiles` | `id` (UUID) | References `auth.users(id)` | Cascades on delete, unique email | Enabled |
| `business_memberships` | `id` (UUID) | References `businesses(id)`, `auth.users(id)` | Unique `(business_id, user_id)`, role in `('owner', 'admin', 'member')` | Enabled |
| `shop_memberships` | `id` (UUID) | References `businesses(id)`, `shops(id)`, `auth.users(id)` | Unique `(shop_id, user_id)`, active status | Enabled |
| `shops` | `id` (UUID) | References `businesses(id)` | Unique `(business_id, name)`, active status | Enabled |
| `products` | `id` (UUID) | References `businesses(id)` | Unique `(business_id, name)`, numeric prices | Enabled |
| `deliveries` | `id` (UUID) | References `businesses(id)`, `shops(id)` | Delivery status in `('pending', 'delivered', 'cancelled')`, payment status | Enabled |
| `delivery_items` | `id` (UUID) | References `deliveries(id)`, `products(id)` | Non-negative quantity, selling price, customer price (CP) | Enabled |
| `payments` | `id` (UUID) | References `businesses(id)`, `shops(id)`, `deliveries(id)` | Amount > 0, payment method, payment date | Enabled |
| `stock_movements` | `id` (UUID) | References `businesses(id)`, `products(id)`, `shops(id)` | Movement type in `('delivery', 'sale', 'adjustment', 'transfer')` | Enabled |
| `invoices` | `id` (UUID) | References `businesses(id)`, `shops(id)` | Invoice number, totals, status | Enabled |
| `daily_reports` | `id` (UUID) | References `businesses(id)`, `shops(id)` | Submission date, approval status | Enabled |
| `daily_report_items` | `id` (UUID) | References `daily_reports(id)`, `products(id)` | Sold quantity, remaining quantity | Enabled |
| `stock_counts` | `id` (UUID) | References `businesses(id)`, `shops(id)`, `products(id)` | Audit count, discrepancy | Enabled |
| `stock_transfers` | `id` (UUID) | References `businesses(id)`, source & dest `shops(id)` | Transfer quantity, transfer status | Enabled |
| `stock_adjustments` | `id` (UUID) | References `businesses(id)`, `products(id)`, `shops(id)` | Adjustment quantity, reason | Enabled |
| `audit_logs` | `id` (UUID) | References `businesses(id)`, `auth.users(id)` | Action, entity, timestamp | Enabled |
| `idempotency_records` | `id` (UUID) | References `businesses(id)` | Unique key, payload hash, expiration | Enabled |
| `maintenance_audit_ledger` | `id` (UUID) | System Table | Maintenance action, execution log | Enabled |

---

## 2. Business Invariants & Integrity Rules

1. **Multi-Tenant Isolation:**
   - Every operational table contains a `business_id` UUID column referencing `public.businesses(id)`.
   - RLS policies ensure queries are scoped strictly to the authenticated user's active business organization.
2. **Delivery & Financial Reconciliation:**
   - `deliveries.total_amount` must equal the sum of `(quantity * unit_price)` across associated `delivery_items`.
   - `deliveries.paid_amount` equals the sum of settled `payments.amount` linked to that delivery.
   - `deliveries.remaining_amount = deliveries.total_amount - deliveries.paid_amount`.
   - `deliveries.payment_status` automatically transitions to `'paid'` when remaining amount reaches zero; otherwise `'partial'` or `'unpaid'`.
3. **Profit Calculation Invariant:**
   - `profit = total_selling_amount - total_customer_cost`.
   - Where `total_customer_cost = quantity * customer_price (CP)`.
   - Selling below CP is permitted (recording a negative profit / loss) when explicitly confirmed by the business owner.
4. **Referential Deletion Protection:**
   - Catalog shops and products cannot be deleted if referenced by existing delivery or ledger records.
   - Deletion attempts on in-use catalog entities return descriptive warnings (`checkShopUsage`, `checkProductUsage`).

---

## 3. Data Safety Commitments

- **No Destructive Operations:** No `DROP TABLE`, `TRUNCATE`, or unconstrained `DELETE` operations are executed against production tables.
- **Authoritative Preservation:** The clean client-owned production database (`xjlnoxbkcyymtdtallzu`) is preserved without inserting mock development records.
- **Owner Account Integrity:** Real owner account (`rtrmobile92@gmail.com`, UUID `ac088d6d-6aef-40b0-8388-51e5d74063a6`) is permanently linked with `role: 'owner'`.
