# Security Findings & Remediation Log

## Initial Workspace Assessment (2026-10-18)

| ID | Severity | Finding | Impact | Status | Remediation Action |
|---|---|---|---|---|---|
| SEC-001 | High | Empty Workspace / Unconfigured Auth Boundary | Risk of misconfiguring service-role access or bypassing RLS. | Mitigated | Enforced non-negotiable rule: backend verifies JWT, RLS applied to all tables, service-role strictly isolated. |
| SEC-002 | Medium | Client-side Role Trust Risk | Risk of employee masquerading as business owner if role stored in localStorage. | Mitigated | Store and verify roles in server-managed `business_memberships` table; verify role in Express JWT guard. |
| SEC-003 | Medium | Duplicate Daily Report Submissions | Network jitter or duplicate clicks causing duplicate stock deductions. | Mitigated | Idempotency key tracking + unique database constraint on `(shop_id, report_date)`. |
| SEC-004 | High | Insecure Multi-shop Isolation | Employee viewing or tampering with another shop's reports or stock. | Mitigated | Express middleware shop-verification + PostgreSQL RLS policies joined with `shop_memberships`. |
