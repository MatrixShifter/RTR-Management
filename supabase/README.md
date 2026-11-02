# RTR Wholesale Management — Database Setup & Architecture Guide

This directory contains the database definition, versioned migrations, and seeding scripts for the RTR Wholesale Management platform (Agency: **Crimpston**, Client: **RTR Mobiles**).

---

## 1. Directory Structure

```text
supabase/
├── schema.sql              # Master consolidated single-file database architecture (26 sections)
├── seed.sql                # Clean baseline seed data (tenant business and initial owner mapping)
├── README.md               # This database guide
└── migrations/             # Immutable versioned migration ledger (0001 - 0011)
    ├── 0001_initial_schema.sql
    ├── 0002_shop_payments_and_transfers.sql
    ├── 0003_align_schema.sql
    ├── 0004_auth_username_and_security.sql
    ├── 0005_remove_employee_auth.sql
    ├── 0006_simplified_records_and_performance.sql
    ├── 0007_fix_delivery_number_and_stock_movements.sql
    ├── 0008_customer_price_and_profit.sql
    ├── 0009_shop_employee_role_and_access.sql
    ├── 0010_permanent_demo_data_removal.sql
    └── 0011_demo_data_removal_and_verify.sql
```

---

## 2. Setting Up a Fresh Database

### Option A: Via Supabase SQL Editor (Recommended for Production & Staging)
1. Open your project dashboard at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** in the left navigation bar.
3. Click **New query**.
4. Copy the entire contents of [`supabase/schema.sql`](./schema.sql).
5. Paste into the editor and click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. Apply [`supabase/seed.sql`](./seed.sql) to populate baseline tenant business configuration.

### Option B: Via Supabase CLI (Local Development)
```bash
# Start local Supabase containers (requires Docker)
npx supabase start

# Apply master schema
npx supabase db reset
```

---

## 3. Migration Management Guidelines

- **Canonical File:** [`supabase/schema.sql`](./schema.sql) is the unified single-file source of truth representing the complete database state across all tables, constraints, functions, triggers, and RLS policies.
- **Incremental Migrations:** Future schema alterations must be authored as incremental, numbered migration files in `supabase/migrations/` (e.g. `0012_feature_name.sql`).
- **Preserve History:** Never delete, mutate, or renumber existing migrations `0001` through `0011`. They provide the complete forensic audit trail of the database lifecycle.
- **Schema Synchronization:** Whenever a new migration is created and verified, mirror the cumulative change into [`supabase/schema.sql`](./schema.sql) so that fresh environments always deploy identically.

---

## 4. Supabase Authentication & Environment Variables

Configure the following environment variables in your deployment environments (`apps/api/.env`, `apps/web/.env`, and Vercel):

| Variable | Description | Exposure |
| :--- | :--- | :--- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Supabase Project URL (`https://<project-ref>.supabase.co`) | Public / Client & Server |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key (public API key) | Public / Client & Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (bypasses RLS) | **Server API Only** (Secret) |
| `PORT` | API Server Port (default: `3001`) | Server |

### Automatic User Profile Generation
A PostgreSQL trigger on `auth.users` automatically syncs new users to `public.profiles`:
- Function: `public.handle_new_user()`
- Trigger: `on_auth_user_created`

---

## 5. Security & Row Level Security (RLS)

All 19 tables in `public` have Row Level Security **strictly enabled**. Access control operates across two primary roles:

### 1. Business Owner (`role = 'owner'`)
- Identified via `public.is_business_owner(business_id)`.
- Full CRUD access over tenant shops, products, deliveries, stock movements, and financial statements.

### 2. Shop Employee (`role = 'employee'`)
- Identified via `public.is_assigned_to_shop(target_shop_id)` and `public.get_employee_assigned_shop_id()`.
- **Strict Read-Only Access:** Allowed `SELECT` only on their assigned shop, deliveries for their assigned shop, products, and their own membership.
- **Zero Mutation Privileges:** All `INSERT`, `UPDATE`, and `DELETE` operations are strictly blocked at the database engine level by RLS.

---

## 6. Verifying Schema & RLS Integrity

To validate SQL syntax, structural integrity, and RLS enablement across all tables and migrations:

```bash
node apps/api/src/validate_sql.mjs
```

Expected output:
```text
✓ 0001_initial_schema.sql passed all structural and security checks.
...
✓ schema.sql passed all structural and security checks.
SUCCESS: All SQL migrations and seeds are validated!
```

---

## 7. Development Seeding & Backup Restoration

### Seeding Development Data
Run the following query in the SQL Editor to link a newly created user as the business owner:
```sql
INSERT INTO public.business_memberships (business_id, user_id, role, is_active)
SELECT 
    '4fba6fb7-4e1b-4106-ac84-908f821d73c3', 
    id, 
    'owner', 
    true
FROM public.profiles 
WHERE email = 'owner@rtrmobiles.com'
ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'owner', is_active = true;
```

### Backup & Restore
- **Backup:** In the Supabase Dashboard, navigate to **Database** -> **Backups** to schedule or trigger manual database snapshots.
- **Restore:** Restore points can be applied directly from the Supabase Dashboard or imported using standard `psql` / pg_restore against the PostgreSQL connection string.
