# Database Schema, Inventory Calculation Model & Migration Guide

## 1. Migration Specification: `0001_initial_schema.sql`

The single unified schema migration file is located at:
[`supabase/migrations/0001_initial_schema.sql`](file:///d:/Crimpston/Clients/Cilent_0002/RTR%20mobiles/05_Devlopment/supabase/migrations/0001_initial_schema.sql)

### Entity Catalog (15 Tables)
1. **`businesses`**: Multi-tenant business root. Configures business timezone and report cutoff time (`21:00:00`).
2. **`profiles`**: Linked to Supabase `auth.users(id)` via `ON DELETE CASCADE`. Stores name, email, avatar.
3. **`business_memberships`**: Connects users to businesses with explicit roles (`owner` or `employee`).
4. **`shops`**: Retail partner store records with unique shop code (`code`), address, and phone.
5. **`shop_memberships`**: Scopes employees to authorized shops (`uq_shop_user`).
6. **`products`**: Mobile accessory catalog (name, unique SKU per business, category, minimum stock threshold).
7. **`deliveries`**: Wholesale supply batches delivered to retail shops.
8. **`delivery_items`**: Line items per delivery (product, quantity > 0, notes).
9. **`daily_reports`**: Daily end-of-day reports submitted by store employees (unique per `(shop_id, report_date)`).
10. **`daily_report_items`**: Line items per report (product, quantity sold >= 0).
11. **`stock_movements`**: Immutable append-only audit ledger tracking every stock addition or deduction.
12. **`stock_counts`**: Periodic in-store physical audits with generated `variance` (`counted_quantity - expected_quantity`).
13. **`stock_adjustments`**: Explicit authorized adjustments resulting from audit counts, damaged stock, or restocks.
14. **`audit_logs`**: Immutable security and administrative activity log.
15. **`idempotency_records`**: Deduplication registry preventing duplicate transactions on network retries.

---

## 2. Inventory Calculation Model

To guarantee financial and inventory accuracy without conflating estimates with verified counts, stock balances are derived strictly through three distinct concepts:

```
[Deliveries (DELIVERY_IN)]
           -
[Approved Sales (SALE_OUT)]
           ±
[Authorized Adjustments (AUDIT_ADJUSTMENT / RETURNS)]
           =
==================================================
           1. CONFIRMED RECORDED STOCK
 (Calculated via public.calculate_shop_stock())
==================================================
           -
[Provisional Sales (Unreviewed Daily Reports)]
           =
==================================================
           2. PROVISIONAL EXPECTED STOCK
==================================================

--------------------------------------------------
           3. PHYSICALLY COUNTED STOCK
 (Stored in stock_counts; variance = counted - expected)
--------------------------------------------------
```

### Calculation Function
```sql
CREATE OR REPLACE FUNCTION public.calculate_shop_stock(target_shop_id UUID, target_product_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(quantity), 0)::INTEGER
  FROM public.stock_movements
  WHERE shop_id = target_shop_id 
    AND product_id = target_product_id
    AND is_provisional = false;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;
```

---

## 3. Database Access Security & RLS Matrix

All 15 tables have Row Level Security (`ENABLE ROW LEVEL SECURITY`) activated with least-privilege grants:

| Table | Anonymous (`anon`) | Employee (`authenticated`) | Owner (`authenticated`) | Protection Rules |
|---|---|---|---|---|
| `businesses` | **DENIED** | SELECT (own business) | SELECT, UPDATE | Employee cannot alter business settings |
| `profiles` | **DENIED** | SELECT (own business), UPDATE (self) | SELECT (own business), UPDATE (self) | User cannot alter other profiles |
| `business_memberships` | **DENIED** | SELECT (own business) | ALL (SELECT, INSERT, UPDATE, DELETE) | **Employee cannot escalate privileges to owner** |
| `shops` | **DENIED** | SELECT (assigned shops only) | ALL (all business shops) | **Employee cannot view unassigned shops** |
| `shop_memberships` | **DENIED** | SELECT (own assignments) | ALL (manage assignments) | Employee cannot reassign themselves |
| `products` | **DENIED** | SELECT (active products) | ALL (manage catalog) | Employee cannot alter SKUs or prices |
| `deliveries` / `delivery_items` | **DENIED** | SELECT (assigned shops) | ALL (record, update, cancel) | Employee cannot forge delivery receipts |
| `daily_reports` / `items` | **DENIED** | SELECT & INSERT (assigned shops) | ALL (review, approve, reject) | Deduplicated by `(shop_id, report_date)` |
| `stock_movements` | **DENIED** | SELECT (assigned shops), INSERT (authorized) | SELECT, INSERT | **IMMUTABLE: UPDATE & DELETE strictly blocked** |
| `stock_counts` | **DENIED** | SELECT & INSERT (assigned shops) | ALL | Verified physical counts |
| `stock_adjustments` | **DENIED** | SELECT (assigned shops) | ALL | Reconciliations require owner authorization |
| `audit_logs` | **DENIED** | INSERT (self actions) | SELECT | **IMMUTABLE: UPDATE & DELETE strictly blocked** |
| `idempotency_records` | **DENIED** | ALL (scoped to own business) | ALL (scoped to own business) | Prevents replay attacks |

---

## 4. How to Apply & Verify the Migration

### Option A: Using Supabase CLI (Recommended)
1. Ensure Docker is running.
2. Apply the migration:
   ```bash
   npx supabase db reset
   ```
   Or apply directly to a remote Supabase project:
   ```bash
   npx supabase db push
   ```

### Option B: Using Direct PostgreSQL Connection (`psql`)
1. Connect using your authorized PostgreSQL connection string:
   ```bash
   psql "postgres://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f supabase/migrations/0001_initial_schema.sql
   ```
2. Verify table creation and RLS activation:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```
3. Load fictional development seed data (never run in production):
   ```bash
   psql "postgres://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f supabase/seed.sql
   ```
