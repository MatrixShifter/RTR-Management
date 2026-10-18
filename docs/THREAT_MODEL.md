# Application Threat Model & Security Controls

## 1. Trust Boundaries
1. **Client / Browser Boundary**: Web browser is completely untrusted. User input, role claims, and cookies must be verified server-side.
2. **Express API Boundary**: Express acts as the application and orchestration tier. Validates JWT, extracts verified user/business/shop claims, and validates all JSON payloads with Zod.
3. **Database Tier (Supabase PostgreSQL)**: Enforces Row-Level Security (RLS) policies, schema integrity constraints, unique indexes, and transaction isolation.

## 2. Threat Analysis & Mitigations

### A. Broken Object Level Authorization (BOLA / IDOR)
- **Threat**: Employee assigned to Store 1 tampers with shopId or deliveryId to view/modify Store 2's inventory or sales reports.
- **Mitigation**: Express middleware checks user shop assignment from database/token context before routing, and Supabase RLS policies enforce `shop_memberships` matching `auth.uid()`.

### B. Privilege Escalation
- **Threat**: Employee submits request with `role: "owner"` or alters profile in browser storage.
- **Mitigation**: Roles are stored in `business_memberships` table, protected by RLS (no employee update permitted). API extracts roles directly from verified database query or authenticated context, never request bodies.

### C. Race Conditions / Double Submissions
- **Threat**: Rapid double-clicking or network retry on "Submit Daily Report" or "Record Delivery" posts duplicate inventory records.
- **Mitigation**: Client sends unique `idempotency_key`. Unique database constraint on `(business_id, idempotency_key)` and unique index on `(shop_id, report_date)` guarantees only one report per shop per date.

### D. SQL Injection & Dynamic SQL
- **Threat**: Malicious SQL injected via search, filters, or form parameters.
- **Mitigation**: Use parameterized queries exclusively via Supabase / pg clients. Raw concatenated SQL is strictly prohibited.

### E. Cross-Site Scripting (XSS) & Content Injection
- **Threat**: Injected scripts in notes or product names.
- **Mitigation**: React handles automatic DOM encoding. CSP headers configured via Helmet. No use of `dangerouslySetInnerHTML`.

### F. Secret Leakage
- **Threat**: Service role keys or database credentials exposed in frontend Vite build.
- **Mitigation**: Strict separation between `VITE_SUPABASE_ANON_KEY` (public client) and backend-only `SUPABASE_SERVICE_ROLE_KEY` / database connection strings. Continuous linting and gitignore checks.
