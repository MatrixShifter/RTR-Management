# RTR Wholesale Management — Feature Coverage Matrix

**Date:** 2026-11-03  
**Status:** Baseline Complete  

This matrix maps every application feature across its frontend UI component, API endpoint, underlying database table, and authorization requirement.

---

## Feature Matrix

| Category | Feature Description | Frontend Component | API Endpoint / Service | Database Tables | Authorization Required | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | Owner Login (Email/Username) | `pages/auth/Login.tsx` | `POST /api/auth/login` | `auth.users`, `business_memberships` | Public | Verified (Unit + Integration) |
| **Auth** | Employee Login (Email + Password) | `pages/auth/Login.tsx` | `POST /api/auth/login` | `auth.users`, `shop_memberships` | Public | Verified (Unit + Integration) |
| **Auth** | Session Verification | `App.tsx` | `GET /api/auth/verify-session` | `business_memberships`, `shop_memberships` | Authenticated | Verified (Passes 416/416 tests) |
| **Auth** | Password Recovery Request | `pages/auth/ForgotPassword.tsx` | `POST /api/auth/forgot-password` | Supabase Auth API | Public | Verified |
| **Auth** | Password Reset Execution | `pages/auth/ResetPassword.tsx` | `POST /api/auth/reset-password` | Supabase Auth API | Recovery Token | Verified |
| **Auth** | Logout & Session Cleansing | `Navbar.tsx`, `App.tsx` | Supabase `signOut()` | LocalStorage / SW Cache | Authenticated | Verified |
| **Dashboard** | Owner Overview KPIs | `pages/owner/OwnerDashboard.tsx` | `getBusinessRecords()` | `deliveries`, `payments`, `delivery_items` | Owner Only | Verified |
| **Dashboard** | Employee Shop Ledger | `pages/employee/EmployeeDashboard.tsx`| `getBusinessRecords()` | `deliveries`, `delivery_items` | Employee (Single Shop) | Verified |
| **Catalog** | Shop Creation & Editing | `components/ManageCatalogModal.tsx` | `saveShop()`, `/api/shops` | `shops` | Owner Only | Verified |
| **Catalog** | Shop Deletion Guard | `components/ManageCatalogModal.tsx` | `deleteShop()`, `/api/shops/:id` | `shops`, `deliveries` | Owner Only | Verified (Blocks in-use shops) |
| **Catalog** | Product Creation & Editing | `components/ManageCatalogModal.tsx` | `saveProduct()`, `/api/products` | `products` | Owner Only | Verified |
| **Catalog** | Product Deletion Guard | `components/ManageCatalogModal.tsx` | `deleteProduct()`, `/api/products/:id` | `products`, `delivery_items` | Owner Only | Verified (Blocks in-use products) |
| **Deliveries** | Record Delivery with CP & Selling Price | `components/RecordEntryDrawer.tsx` | `recordDelivery()`, `/api/records` | `deliveries`, `delivery_items`, `stock_movements` | Owner Only | Verified |
| **Deliveries** | Delivery Confirmation Modal | `components/ConfirmDeliveryModal.tsx` | `updateDeliveryStatus()`, `/api/records/:id/delivery-status` | `deliveries`, `stock_movements` | Owner Only | Verified (Calculates CP & profit) |
| **Deliveries** | Delete Delivery Record | `components/RecordActionsMenu.tsx` | `deleteBusinessRecord()`, `/api/records/:id` | `deliveries`, `delivery_items`, `payments`, `stock_movements` | Owner Only | Verified |
| **Payments** | Full & Partial Payment Settlement | `components/SettlePaymentModal.tsx` | `settleRecordPayment()`, `/api/records/settle` | `payments`, `deliveries` | Owner Only | Verified |
| **Reports** | Monthly Shop-Wise Statements | `pages/owner/MonthlyShopStatement.tsx` | `getBusinessRecords()`, `getPayments()` | `deliveries`, `payments` | Owner Only | Verified |
| **Reports** | Individual Shop Statement & Profit | `pages/owner/IndividualShopStatement.tsx`| `getShopHistoricalSummary()` | `deliveries`, `delivery_items`, `payments` | Owner Only | Verified |
| **Employees** | Create Shop Employee | `components/EmployeeManagementSection.tsx`| `createEmployee()`, `POST /api/employees` | `auth.users`, `profiles`, `shop_memberships` | Owner Only | Verified |
| **Employees** | Reassign Employee Shop | `components/EmployeeManagementSection.tsx`| `reassignEmployeeShop()`, `PATCH /api/employees/:id/shop` | `shop_memberships` | Owner Only | Verified |
| **Employees** | Toggle Active Status | `components/EmployeeManagementSection.tsx`| `toggleEmployeeStatus()`, `PATCH /api/employees/:id/status` | `profiles`, `shop_memberships` | Owner Only | Verified |
| **Employees** | Reset Employee Password | `components/EmployeeManagementSection.tsx`| `resetEmployeePassword()`, `POST /api/employees/:id/reset-password` | Supabase Admin API | Owner Only | Verified |
| **Settings** | Business Profile & Owner Config | `pages/owner/Settings.tsx` | `GET /api/settings`, `PATCH /api/settings` | `businesses` | Owner Only | Verified |
| **Offline** | Background Sync & Caching | `services/syncEngine.ts`, `offlineStorage.ts` | IndexedDB `rtr_offline_db` | Client Cache | Local Device | Verified |
| **PWA** | Install App Prompt & Banner | `components/InstallAppBanner.tsx` | `services/usePwaInstall.ts` | Web App Manifest | Public | Verified |
