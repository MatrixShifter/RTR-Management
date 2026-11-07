# RTR WHOLESALE MANAGEMENT — DATABASE INTEGRITY REPORT

**Date:** November 7, 2026  
**Authoritative Instance:** Supabase PostgreSQL (`xjlnoxbkcyymtdtallzu`)  
**Status:** Verified, Consistent, and Fully Intact  

---

## 1. Relational Schema & Table Architecture

The RTR Wholesale Management relational database schema enforces strict referential integrity across all operational entities:

```
[ businesses ]
       ▲
       ├── [ business_memberships ] ── [ auth.users ]
       │                                     ▲
       ├── [ shops ]                         │
       │       ▲                             │
       │       ├── [ shop_memberships ] ─────┘
       │       │
       │       └── [ deliveries ]
       │                 ▲
       │                 ├── [ delivery_items ] ── [ products ]
       │                 │
       │                 └── [ invoices ] ──────── [ shop_payments ]
       │
       └── [ products ]
```

---

## 2. Table-by-Table Verification Matrix

| Table Name | Primary Key | Foreign Key Relationships | Unique & Check Constraints | RLS Enabled | Persistence Verified |
|:---|:---:|:---|:---|:---:|:---:|
| `businesses` | `id` (UUID) | None (Root Tenant) | `name` NOT NULL | Yes | **PASS** |
| `business_memberships` | `id` (UUID) | `business_id` → `businesses(id)`<br>`user_id` → `auth.users(id)` | UNIQUE(`business_id`, `user_id`)<br>`role` IN ('owner', 'employee') | Yes | **PASS** |
| `profiles` | `id` (UUID) | `id` → `auth.users(id)` | `email` NOT NULL | Yes | **PASS** |
| `shops` | `id` (UUID) | `business_id` → `businesses(id)` | `name` NOT NULL, `is_active` BOOL | Yes | **PASS** |
| `shop_memberships` | `id` (UUID) | `shop_id` → `shops(id)`<br>`user_id` → `auth.users(id)` | UNIQUE(`shop_id`, `user_id`) | Yes | **PASS** |
| `products` | `id` (UUID) | `business_id` → `businesses(id)` | `name` NOT NULL, `default_price` NUMERIC | Yes | **PASS** |
| `deliveries` | `id` (UUID) | `business_id` → `businesses(id)`<br>`shop_id` → `shops(id)` | `delivery_number` UNIQUE<br>`status` IN ('pending', 'delivered') | Yes | **PASS** |
| `delivery_items` | `id` (UUID) | `delivery_id` → `deliveries(id)`<br>`product_id` → `products(id)` | `quantity` >= 0, `unit_price` >= 0 | Yes | **PASS** |
| `invoices` | `id` (UUID) | `business_id` → `businesses(id)`<br>`delivery_id` → `deliveries(id)` | `total_amount` = `paid_amount` + `outstanding_amount` | Yes | **PASS** |
| `shop_payments` | `id` (UUID) | `shop_id` → `shops(id)`<br>`invoice_id` → `invoices(id)` | `amount` > 0 | Yes | **PASS** |

---

## 3. Financial Integrity & Precision Verification

1. **Monetary Computation:**
   All monetary fields (`unit_price`, `total_amount`, `paid_amount`, `outstanding_amount`, `customer_price`, `profit`) utilize exact `NUMERIC(12, 4)` and `NUMERIC(12, 2)` representations to eliminate floating-point rounding errors.
2. **Reconciliation Formula:**
   $$\text{Total Invoice Amount} = \text{Paid Amount} + \text{Outstanding Balance}$$
   $$\text{Net Profit} = (\text{Customer Price} \times \text{Quantity}) - (\text{Wholesale Unit Price} \times \text{Quantity})$$
   All 6 accounting test scenarios (Scenarios A through F) pass with zero reconciliation discrepancy.
3. **Foreign Key Deletion Safety:**
   - Attempting to delete a shop with linked deliveries returns `400 Bad Request` (`CANNOT_DELETE_ACTIVE_SHOP_WITH_RECORDS`).
   - Attempting to delete a product with linked delivery line items returns `400 Bad Request` (`CANNOT_DELETE_PRODUCT_WITH_DELIVERIES`).
