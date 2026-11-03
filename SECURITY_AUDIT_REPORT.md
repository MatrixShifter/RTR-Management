# RTR Wholesale Management — Security Audit Report

**Date:** 2026-11-03  
**Status:** High Assurance / Hardened  

---

## 1. Security Architecture Overview

The RTR Wholesale Management application enforces defense-in-depth across the client frontend, serverless API layer, Express backend, and Supabase PostgreSQL data layer:

```
[ Browser / React App ]
         │ (Public Anon Key only, strict CSP, CORS, HTTPS)
         ▼
[ Express API / Vercel Serverless ]
         │ (Rate limiting, Helmet headers, Zod payload validation, sanitized logging)
         ▼
[ Supabase PostgreSQL + Auth ]
         │ (JWT validation, RLS policies, service-role admin boundary)
         ▼
[ Multi-Tenant Relational Tables ]
```

---

## 2. Security Assessment Matrix

| Domain | Control Mechanism | Implementation | Verification Status |
| :--- | :--- | :--- | :--- |
| **Authentication** | Passwords | Hashed via Supabase Auth (bcrypt/argon2). Never logged or transmitted in plaintext. | Verified |
| **Authentication** | Username Aliases | Canonical owner aliases (`owner`, `vino`, `rtrowner`) resolve server-side without revealing email existence. | Verified |
| **Authorization** | Role-Based Access Control | Strict segregation between `owner` and `employee`. Employees have single-shop read-only access. | Verified |
| **Data Isolation** | Row Level Security (RLS) | Enabled on all public tables. Users can only access data belonging to their assigned `business_id`. | Verified |
| **Credential Safety** | Service-Role Secrets | Service-role keys reside strictly in server environment variables (`apps/api` and `apps/web/api`). Never exposed to browser bundles. | Verified |
| **HTTP Protection** | Security Headers | Helmet configured with HSTS (1 year preload), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, and strict CSP. | Verified |
| **Network Security**| CORS Enforcement | Origin whitelisting restricted to production domain (`.vercel.app`), localhost dev, and configured `CORS_ORIGIN`. | Verified |
| **Abuse Prevention**| Rate Limiting | In-memory sliding window rate limiters on `/api/auth/login` (5/min), `/api/auth/forgot-password` (3/min), and mutation routes. | Verified |
| **Audit Logging** | Terminal Sanitization | `sanitizeUrl()` strips sensitive UUIDs, password reset hashes, and query tokens from access logs. | Verified |
| **Injection Safety**| Parameterized Queries | All queries execute via Supabase PostgREST client with parameterized bindings, preventing SQL injection. | Verified |

---

## 3. Vulnerability Findings & Remediation

1. **Service-Role Key Exposure Guard:**
   - Client bundle check confirmed: zero references to `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/src`.
   - Frontend accesses Supabase strictly with `VITE_SUPABASE_ANON_KEY`.
2. **Open Redirect Prevention:**
   - In `apps/web/api/auth/forgot-password.ts` and `apps/api/src/routes/auth.ts`, redirect destinations are validated against allowed hosts to prevent arbitrary external redirect phishing.
3. **Information Disclosure in Error Messages:**
   - Login endpoints return unified `INCORRECT_CREDENTIALS_MSG` ("Incorrect username or password. Please try again.") to prevent username enumeration attacks.
4. **Employee Privilege Escalation Guard:**
   - Employee role strictly disallows accessing owner endpoints (`/api/settings`, `/api/employees`, `/api/shops`, `/api/records` mutations). Calls without `role: 'owner'` in JWT or membership record return HTTP 403 Forbidden.
