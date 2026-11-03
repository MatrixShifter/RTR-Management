# RTR Wholesale Management — Defect & Bug Tracker

**Date:** 2026-11-03  
**Status:** All Critical/High Priority Defects Resolved in Current Baseline  

---

## Defect Inventory & Resolution Log

| Bug ID | Severity | Category | Description | Root Cause | Fix Implementation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | Critical | Environment / Auth | Split-Brain Supabase Configuration | `apps/web/src/lib/supabase.ts` and `apps/web/api/_supabase.ts` had fallback references to legacy development project (`lwyxzmrxxviiuzztpwar`), while Vercel frontend pointed to production (`xjlnoxbkcyymtdtallzu`). | Replaced all references with authoritative production project (`xjlnoxbkcyymtdtallzu`), added guard checks blocking the deprecated project, and configured Zod `.superRefine()` validation in `apps/api/src/config.ts`. | **RESOLVED & VERIFIED** |
| **BUG-002** | Critical | Auth / Session | 1-Second Auto-Logout After Owner Login | In `apps/web/src/App.tsx`, 401/403 responses from `/api/auth/verify-session` triggered immediate `signOut()` and `localStorage.clear()`. When frontend and backend project tokens mismatched, JWT validation failed and logged user out immediately. | Aligned projects, stabilized `runInitSession()` dependencies with `useRef`, and allowed graceful fallback to direct Supabase token validation before session termination. | **RESOLVED & VERIFIED** |
| **BUG-003** | High | Database / Auth | Missing Owner Business Membership | Production Supabase database had Auth user `ac088d6d-6aef-40b0-8388-51e5d74063a6`, but `business_memberships` table had 0 rows for that user, causing role check to return 403. | Inserted owner membership for `ac088d6d-6aef-40b0-8388-51e5d74063a6` in business `4fba6fb7-4e1b-4106-ac84-908f821d73c3`. Added automated self-healing link logic in `login.ts`, `verify-session.ts`, and `routes/auth.ts`. | **RESOLVED & VERIFIED** |
| **BUG-004** | High | Auth / Recovery | Password Recovery Link Expiration | Recovery links generated without matching site URL or consumed multiple times by prefetching scanners caused `otp_expired` error. | Configured branded email templates, updated URL configuration in Supabase Dashboard, and ensured token exchange occurs once with explicit state confirmation. | **RESOLVED & VERIFIED** |
| **BUG-005** | Medium | Security / Logs | Terminal Information Leakage | Express HTTP logger was logging query parameters that could contain sensitive tokens or emails during password recovery or login. | Implemented `sanitizeUrl()` helper in `logger.ts` to redact UUIDs, reset tokens, and query credentials from all terminal logs. | **RESOLVED & VERIFIED** |
| **BUG-006** | Medium | UI / Role Restriction | Employee Sidebar Clutter | Employees accessing `/employee` had residual desktop navigation links leading to restricted owner routes. | Removed sidebar navigation for employee sessions, rendering a clean, focused, single-shop responsive dashboard with zero owner menu leakage. | **RESOLVED & VERIFIED** |
| **BUG-007** | Low | Build / Config | Missing Root Lint Script | Running `npm run lint` threw workspace lifecycle script error because individual packages lacked `lint` entries. | Identified in baseline audit; documented in project handover. | **DOCUMENTED** |
