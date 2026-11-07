# RTR WHOLESALE MANAGEMENT — SYSTEM ARCHITECTURE DOCUMENT

**Client Organization:** RTR Mobiles  
**Application Title:** RTR Wholesale Management System  
**Version:** 1.0.0 Production Release  
**Last Updated:** November 7, 2026  

---

## 1. High-Level Architectural Overview

RTR Wholesale Management is an enterprise-grade mobile accessories distribution, ledger, and shop settlement platform engineered for multi-tier operations. The system employs a modern decoupled client-server architecture with an authoritative database backend:

```
[ Frontend: React 18 + Vite (SPA) ] 
       │                 ▲
       │ HTTPS / JSON    │ Supabase Auth & Storage Realtime
       ▼                 ▼
[ Express API Server (Node.js 22 LTS) ]
       │
       │ Parameterized Connection / Service Role Key
       ▼
[ PostgreSQL Database (Supabase Enterprise Managed) ]
       ├── Row Level Security (RLS)
       ├── Business Tenant Isolation
       ├── Financial Ledgers & Settlements
       └── Role-Based Access Controls (RBAC)
```

---

## 2. Component Architecture

### A. Frontend Layer (`@crimpston/web`)
- **Technology Stack:** React 18.3.1, TypeScript 5.5, Vite 8.3, Tailwind CSS v4, Lucide Icons.
- **Routing:** React Router v7 with dedicated route guards:
  - Public Authentication: `/login`, `/forgot-password`, `/reset-password`
  - Business Owner Portal: `/records` (Ledger), `/statements` (Reporting & P&L), `/settings` (Store & Employee Administration)
  - Shop Employee Portal: Scoped `/records` and `/employee` views restricted strictly to assigned shop operations.
- **State Management & Synchronization:**
  - Optimistic client-side UI mutations with guaranteed server reconciliation.
  - Proactive session rotation and cross-tab storage synchronizer (`storage` event listeners).
  - Bounded exponential backoff retry loop absorbing cold starts and transient network latency.

### B. Backend API Layer (`@crimpston/api`)
- **Technology Stack:** Node.js 22 LTS, Express 4.21, TypeScript 5.5.
- **Security & Protection Stack:**
  - Helmet for Content Security Policy (CSP), strict HTTP Strict Transport Security (HSTS), and clickjacking prevention (`X-Frame-Options: DENY`).
  - Strict CORS origin whitelisting (`rtr-management.vercel.app`, authorized Vercel preview environments, local dev).
  - Express Rate Limiting with tiered policies (Standard: 120 req/min; Password Recovery: 5 req/15 min).
  - Secure correlation tracking (`x-correlation-id`) on every incoming request.
  - Safe audit logger redacting authorization headers, tokens, and personally identifiable credentials.

### C. Shared Domain Layer (`@crimpston/shared`)
- **Technology Stack:** TypeScript 5.5, Zod 3.23.
- **Responsibilities:**
  - Authoritative validation schemas for financial records, deliveries, shops, and products.
  - Record priority computation and delivery status normalization.
  - Demo entity classification rules preventing mock data leakage into production ledgers.

### D. Authoritative Persistence Layer (Supabase / PostgreSQL)
- **Production Instance Reference:** `xjlnoxbkcyymtdtallzu`
- **Tenant Isolation:** Multi-tenant architecture keyed on `business_id`.
- **Row Level Security (RLS):**
  - Business owners possess scoped administrative access across their registered businesses.
  - Employees are restricted to read-only access for transactions, shops, and products matching their assigned store.
  - Zero cross-tenant data leakage enforced at the database kernel level.

---

## 3. Communication & Data Flow

1. **Authentication:**
   - Owner/employee logs in through `/api/auth/login` or Supabase Auth.
   - Server returns signed JWT access token and refresh token.
   - Frontend hydrates session into authenticated state and manages proactive refresh prior to expiry.
2. **Record Creation & Workflow:**
   - User triggers Add Record via Primary CTA or `+` keyboard shortcut.
   - Dynamic searchable dropdowns allow selecting existing shops/products or registering new catalog items inline.
   - Pressing Enter or clicking Save executes client-side Zod validation, enforces idempotent duplicate submission locks, and persists transaction via `/api/records`.
   - UI updates optimistically with immediate cache refresh.
3. **Settlement & Reporting:**
   - Statements module consolidates monthly shop-wise purchases, customer selling price (CP), revenue, and profit calculations with zero calculation drift.
