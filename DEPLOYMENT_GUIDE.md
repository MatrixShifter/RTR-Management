# RTR WHOLESALE MANAGEMENT — PRODUCTION DEPLOYMENT GUIDE

**Target Production Domain:** `https://rtr-management.vercel.app`  
**API Server:** Render Web Service (`https://rtr-management-api.onrender.com` or Vercel Serverless)  
**Authoritative Database:** Supabase PostgreSQL (`https://xjlnoxbkcyymtdtallzu.supabase.co`)  

---

## 1. Environment Variable Configuration

### A. Frontend Web Client (Vercel Project Settings)
```ini
VITE_SUPABASE_URL=https://[YOUR_SUPABASE_PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[SUPABASE_ANON_KEY_FROM_DASHBOARD]
VITE_API_URL=https://rtr-management-api.onrender.com
VITE_OWNER_EMAIL=rtrmobile92@gmail.com
```

### B. Backend API Server (Render / Serverless Settings)
```ini
NODE_ENV=production
PORT=4000
SUPABASE_URL=https://[YOUR_SUPABASE_PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=[SUPABASE_ANON_KEY_FROM_DASHBOARD]
SUPABASE_SERVICE_ROLE_KEY=[SUPABASE_SERVICE_ROLE_KEY_FROM_DASHBOARD]
CORS_ORIGIN=https://rtr-management.vercel.app
OWNER_EMAIL=rtrmobile92@gmail.com
```

---

## 2. Build & Verification Commands

1. **Clean Workspace Install:**
   ```bash
   npm ci
   ```
2. **Execute Full Monorepo Build:**
   ```bash
   npm run build
   ```
   *(Verifies compilation for `@crimpston/shared`, builds `@crimpston/api` into `apps/api/dist`, and bundles `@crimpston/web` into `apps/web/dist` with static SPA fallback routing).*
3. **Execute Full Test Suite:**
   ```bash
   npm test
   ```
   *(All 454 unit and integration tests must pass prior to initiating a deployment).*

---

## 3. Supabase Auth URL Configuration Check

In the [Supabase Dashboard](https://supabase.com/dashboard/project/xjlnoxbkcyymtdtallzu) under **Authentication** &rarr; **URL Configuration**:
1. **Site URL:**
   `https://rtr-management.vercel.app`
2. **Redirect URLs (Allowlist):**
   - `https://rtr-management.vercel.app/reset-password`
   - `https://rtr-management.vercel.app/login`
   - `https://rtr-management.vercel.app`
   - `http://localhost:5173/reset-password`
   - `http://localhost:5173/login`
   - `http://localhost:5173`
