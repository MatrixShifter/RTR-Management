# Deployment & Production Readiness Guide

## 1. Deployment Topology
- **Frontend SPA**: Hosted on Vercel or modern static CDN with Single Page Application routing redirects.
- **Backend API**: Hosted on Node.js container environment (e.g. Railway, Render, Fly.io, or AWS ECS/App Runner).
- **Database**: Managed Supabase PostgreSQL with automated point-in-time recovery (PITR) and connection pooling via PgBouncer / Supavisor.

---

## 2. Environment Variables Configuration

### Production Web (`apps/web`)
Set in Vercel project environment variables:
- `VITE_API_URL`: `https://api.yourdomain.com/api`
- `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `[Your Public Anon Key]`

### Production API (`apps/api`)
Set in Node.js server container:
- `PORT`: `4000` (or host provided port)
- `NODE_ENV`: `production`
- `CORS_ORIGIN`: `https://app.yourdomain.com`
- `SUPABASE_URL`: `https://your-project.supabase.co`
- `SUPABASE_ANON_KEY`: `[Your Public Anon Key]`
- `SUPABASE_SERVICE_ROLE_KEY`: `[Your Secret Service Role Key - Server Only]`

---

## 3. Database Migration Steps
1. Apply schema migration:
   ```bash
   psql -f supabase/migrations/20261018000000_initial_schema.sql
   ```
2. Apply RLS policies migration:
   ```bash
   psql -f supabase/migrations/20261018000001_rls_policies.sql
   ```
3. Verify table grants and verify RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```

---

## 4. Post-Deployment Smoke Test Checklist
- [ ] Health endpoint responds 200 at `/api/health` without secret leakage.
- [ ] Security headers (`X-Frame-Options`, `X-Content-Type-Options`) verified in HTTP response.
- [ ] Owner logs in and verifies dashboard metrics.
- [ ] Delivery created and immediately reflected in Stock Ledger.
- [ ] Employee logs in, restricted only to assigned store, and successfully submits a daily report.
- [ ] Idempotency prevents duplicate submissions on double-click.
- [ ] Unauthorized attempt to fetch unassigned store data returns empty or forbidden.
