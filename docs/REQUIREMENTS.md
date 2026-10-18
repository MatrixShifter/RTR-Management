# Functional & Technical Requirements

## 1. Product Overview
Crimpston Wholesale Accessories Management System is designed to manage the distribution, delivery, employee daily reporting, and inventory ledger of mobile accessories across retail partner shops (e.g., cases, tempered glass, chargers, cables, earphones).

## 2. Core Personas
1. **Business Owner**:
   - Manages shops, catalog products, and employee access assignments.
   - Records supplier deliveries to shops (with product, quantity, shop destination, timestamps).
   - Monitors daily reports, zero-sales notifications, pending reports, and discrepancies.
   - Reviews and approves/rejects daily employee sales reports and physical counts.
   - Views end-to-end stock ledger (provisional vs. confirmed vs. physically counted).
2. **Shop Employee**:
   - Authenticates into their assigned shop(s).
   - Submits daily sales reports with quantities per product or explicit zero-sales declarations.
   - Records physical stock counts and returns/discrepancies when authorized.
   - Views submission history and approval/correction statuses.

## 3. Core Business Rules
- **Shop Scoping**: Employees have access *only* to their assigned shop(s). Access is verified strictly on server and database policies.
- **Reporting Deadlines & Zero Sales**: A missing report is an active pending task for the owner. A zero-sales day must be explicitly declared and treated as a completed report, distinguishable from missing/omitted reports.
- **Stock Ledger & Immutability**:
  - Deliveries increment shop stock.
  - Approved sales decrement shop stock.
  - Three distinct inventory states:
    1. *Provisional Stock* (accounting for unverified submissions / in-flight offline queues).
    2. *Confirmed Recorded Stock* (backed by owner-approved deliveries and reports).
    3. *Physically Counted Stock* (verified in-store audit counts).
  - All adjustments and corrections are append-only audit entries. No silent modifications of historic transactions.
- **Financial & Settlement Boundary**:
  - Consignment vs. direct sale vs. revenue share is currently unconfirmed by business stakeholders.
  - Inventory and delivery ledger tracks quantities and physical flow cleanly without premature invoicing/tax/consignment assumptions.

## 4. Technical Non-Negotiables
- Strict TypeScript everywhere (frontend and backend).
- React + Vite + Tailwind CSS + TanStack Query + React Hook Form + Zod.
- Node.js + Express + Zod + Helmet + rate limiting.
- Supabase PostgreSQL with strict Row Level Security (RLS) policies and least-privilege role permissions.
- Centralized error handling, structured logging with secret redaction, and no reliance on frontend checks as security boundaries.
