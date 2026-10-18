# Architecture & Business Decision Log

| ID | Date | Category | Decision | Status | Context & Rationale |
|---|---|---|---|---|---|
| ADR-001 | 2026-10-18 | Architecture | Monorepo Structure (`apps/web`, `apps/api`, `packages/shared`) | Confirmed | Keeps frontend and Express API code unified with shared types and validation schemas (Zod). |
| ADR-002 | 2026-10-18 | Business / Domain | Separation of Inventory Quantities vs Financial Settlement | Confirmed | Stock ownership model (consignment vs immediate wholesale purchase) is unconfirmed. Financial logic is deferred; quantity ledger is strictly append-only. |
| ADR-003 | 2026-10-18 | Inventory | 3-Tier Stock Ledger Model (Provisional, Confirmed, Physical Count) | Confirmed | Prevents conflating unreviewed daily employee reports with confirmed stock. Prevents presenting calculated stock as physically audited truth. |
| ADR-004 | 2026-10-18 | Security | Zero-Trust Database Access & Dual-Check Auth | Confirmed | Supabase JWTs validated on Express API using Supabase Auth. Tables enforce RLS policies restricting read/write to authorized business/shop IDs. No universal service-role bypass in API handlers. |
| ADR-005 | 2026-10-18 | Security | Idempotent Submission Handling | Confirmed | Client-provided idempotency keys on deliveries and daily sales reports prevent duplicate stock movements upon network retries or repeated button clicks. |
| ADR-006 | 2026-10-18 | UX / Reporting | Explicit Zero-Sales Submission | Confirmed | Store employees can submit a verified "0 sales today" report. This marks the shop reporting task complete while adjusting 0 inventory units. |
