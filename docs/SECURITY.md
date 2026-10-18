# Application Security Controls & Standards

Aligned with **OWASP ASVS 5.0.0** and **OWASP Top 10:2025**.

## 1. Authentication & Session Security (ASVS V2 & V3)
- Authenticated via Supabase Auth.
- Passwords never stored or processed in application logs.
- Sensitive credentials, API keys, and JWT secrets are kept in environment variables on trusted server components only.
- Strict rate limiting configured on all authentication routes (`/api/auth/*`).

## 2. Access Control & Authorization (ASVS V4)
- **Role Isolation**: Only `owner` can add products, create shops, view all shops, approve sales reports, and record deliveries.
- **Shop Scoping**: Employees are restricted strictly to shops mapped in `shop_memberships`.
- **Database RLS**: Every table in PostgreSQL has RLS enabled. Helper functions (`is_business_owner`, `is_assigned_to_shop`) enforce access policies at the database engine level.
- **Client Role Mistrust**: Roles stored in localStorage or client state are never trusted by the Express API. The backend retrieves the role directly from `business_memberships`.

## 3. Input Validation & Data Sanitization (ASVS V5)
- All incoming payloads are validated using strict Zod schemas.
- Extra unknown fields are stripped or rejected.
- String inputs have strict minimum and maximum lengths to prevent buffer exhaustion.
- Integer quantities for deliveries must be strictly positive (`> 0`). Quantities sold cannot be negative (`>= 0`).

## 4. Cryptography & Secret Hygiene (ASVS V6)
- Public Vite frontend only receives `VITE_SUPABASE_ANON_KEY`.
- Backend service role key (`SUPABASE_SERVICE_ROLE_KEY`) is never bundled or exposed in frontend builds.
- Database URLs and secrets are gitignored.

## 5. Web Headers & Communications (ASVS V14)
- **Helmet**: Enforces secure HTTP headers including `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict `Content-Security-Policy`.
- **CORS**: Scoped strictly to trusted frontend origins (`config.CORS_ORIGIN`).
- **Structured Logging**: `sanitizeData` automatically redacts sensitive keywords (`password`, `token`, `secret`, `key`, `authorization`).
