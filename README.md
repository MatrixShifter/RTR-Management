# Crimpston Wholesale Accessories Management System

A production-oriented enterprise inventory, delivery, and sales management platform designed for wholesale mobile phone accessory distribution across multi-store retail partner networks.

## Architecture Highlights
- **Frontend SPA**: React 18, Vite, TypeScript (strict mode), Tailwind CSS, TanStack Query, React Hook Form, Zod.
- **Backend API**: Node.js, Express.js, TypeScript, Zod validation, Helmet security headers, structured logging, distributed rate limiting.
- **Database & Auth**: Supabase PostgreSQL with strict Row-Level Security (RLS) policies, foreign key integrity, append-only stock movement ledger.
- **Monorepo Structure**:
  - `apps/web`: Web application for both Owner and Employee operations.
  - `apps/api`: REST API handling business workflows, idempotency, and server-side aggregation.
  - `packages/shared`: Shared TypeScript types, Zod schemas, and domain models.
  - `supabase/migrations`: Version-controlled SQL migrations, functions, and RLS policies.

---

## Prerequisites
- Node.js >= 20.x (tested on v24.x)
- npm >= 10.x
- Supabase project or local Supabase CLI

---

## Quickstart & Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root (or in `apps/api` and `apps/web` respectively):
```bash
cp .env.example .env
```
Fill in your Supabase project URL and keys. Note: Never commit real credentials to Git.

### 3. Build Shared Packages & Applications
```bash
npm run build
```

### 4. Run Development Servers
- Run API server:
  ```bash
  npm run dev:api
  ```
- Run Web interface:
  ```bash
  npm run dev:web
  ```

### 5. Run Test Suite
```bash
npm test
```

---

## Security & Verification Standards
- **OWASP ASVS 5.0.0 & OWASP Top 10:2025 Compliance**: Strict parameterization, CSP headers, rate-limiting, least-privilege database roles, and business-level multi-tenant isolation.
- **No Client Role Trust**: Access permissions are strictly resolved from server-verified database records (`business_memberships` and `shop_memberships`).
- **Append-only Stock Ledger**: All deliveries and approved sales write immutable audit records into `stock_movements`.
