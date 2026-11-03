# RTR Wholesale Management — Complete API Audit Report

**Date:** 2026-11-03  
**Status:** Audit & Inventory Complete  

---

## 1. API Architecture Overview

The RTR Wholesale Management backend exposes REST endpoints through two deployment modes:
1. **Render Express Application (`apps/api`):** Long-running Node.js process serving `/api/*` endpoints.
2. **Vercel Serverless Functions (`apps/web/api`):** Serverless micro-functions mirroring core authentication and employee management routes when deployed without an external Express server.

---

## 2. API Endpoint Inventory & Audit

### Authentication Endpoints (`/api/auth`)
| Method | Route | Description | Auth Required | Rate Limited | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate owner or employee via email/username + password | Public | Yes (5/min) | 200, 401, 403, 429, 500 |
| `POST` | `/api/auth/forgot-password` | Request password reset instructions | Public | Yes (3/min) | 200, 400, 429, 500 |
| `POST` | `/api/auth/reset-password` | Set new password via recovery session | Recovery Token | Yes | 200, 400, 401, 500 |
| `GET` | `/api/auth/verify-session` | Validate session token & return user profile | Bearer Token | No (Polling) | 200, 401, 403, 500 |
| `POST` | `/api/auth/employee-login` | Dedicated employee login endpoint | Public | Yes | 200, 401, 403, 500 |
| `POST` | `/api/auth/request-employee-otp` | Request employee OTP (if OTP mode active) | Public | Yes | 200, 400, 429, 500 |
| `POST` | `/api/auth/verify-employee-otp` | Verify employee OTP & issue session | Public | Yes | 200, 400, 401, 500 |

### Business Records Endpoints (`/api/records`)
| Method | Route | Description | Auth Required | Role Required | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/records` | Query delivery records, items, payments | Bearer Token | `owner` or `employee` (scoped) | 200, 401, 403, 500 |
| `POST` | `/api/records` | Create new delivery with items & CP | Bearer Token | `owner` | 201, 400, 401, 403, 500 |
| `POST` | `/api/records/settle` | Settle full or partial delivery payment | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `PATCH`| `/api/records/:id/delivery-status` | Confirm delivery status & finalize stock | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `DELETE`| `/api/records/:id` | Delete delivery record & rollback stock | Bearer Token | `owner` | 200, 400, 401, 403, 500 |

### Catalog Endpoints (`/api/shops`, `/api/products`)
| Method | Route | Description | Auth Required | Role Required | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/shops` | List active retail shops | Bearer Token | `owner` or `employee` | 200, 401, 500 |
| `GET` | `/api/shops/:id/usage` | Check if shop has associated deliveries | Bearer Token | `owner` | 200, 401, 403, 500 |
| `DELETE`| `/api/shops/:id` | Safely delete unreferenced shop | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `GET` | `/api/products` | List wholesale product catalog | Bearer Token | `owner` or `employee` | 200, 401, 500 |
| `GET` | `/api/products/:id/usage` | Check if product is in delivery items | Bearer Token | `owner` | 200, 401, 403, 500 |
| `DELETE`| `/api/products/:id` | Safely delete unreferenced product | Bearer Token | `owner` | 200, 400, 401, 403, 500 |

### Employee Management Endpoints (`/api/employees`)
| Method | Route | Description | Auth Required | Role Required | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/employees` | List all business employees & shop assignments | Bearer Token | `owner` | 200, 401, 403, 500 |
| `POST` | `/api/employees` | Provision new employee account & assign shop | Bearer Token | `owner` | 201, 400, 401, 403, 500 |
| `PATCH`| `/api/employees/:id/shop` | Reassign employee to another shop | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `PATCH`| `/api/employees/:id/status` | Activate or deactivate employee login | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `DELETE`| `/api/employees/:id` | Revoke employee access & delete membership | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `POST` | `/api/employees/:id/reset-password` | Admin reset of employee password | Bearer Token | `owner` | 200, 400, 401, 403, 500 |

### Settings & Health Endpoints
| Method | Route | Description | Auth Required | Role Required | Status Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/settings` | Read business configuration | Bearer Token | `owner` | 200, 401, 403, 500 |
| `PATCH`| `/api/settings` | Update business name or settings | Bearer Token | `owner` | 200, 400, 401, 403, 500 |
| `GET` | `/api/health` | Service uptime and health check | Public | None | 200 |
| `GET` | `/api/database/storage-health` | Telemetry on database storage usage | Public | None | 200 |
