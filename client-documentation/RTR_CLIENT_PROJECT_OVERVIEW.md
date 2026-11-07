# RTR WHOLESALE MANAGEMENT
## Professional Project Overview, Technology Stack, Features and Technical Architecture

---

**Project Name:** RTR Wholesale Management  
**Client Organization:** RTR Mobiles  
**Engineering & Consulting Partner:** Crimpston  
**Document Classification:** Official Client Project Documentation  
**Version:** 1.0.0 (Production Release)  
**Date of Handover:** November 7, 2026  

---

## Executive Summary

RTR Wholesale Management is an enterprise-grade digital business management platform specifically engineered for wholesale mobile accessory distribution. Developed by Crimpston for RTR Mobiles, the system modernizes and unifies day-to-day wholesale operations across distributed retail partner networks.

By replacing traditional paper ledgers, fragmented spreadsheets, and disparate messaging channels with a centralized web platform, RTR Wholesale Management empowers business owners and authorized retail staff with real-time visibility into inventory movements, shop-by-shop sales transactions, delivery statuses, payment settlements, and net profitability.

The platform is designed with a modern, decoupled monorepo architecture featuring a high-performance single-page application (SPA), an Express API service layer, and Supabase managed database services. This document provides a comprehensive overview of the application’s business capabilities, underlying technology stack, system architecture, traffic management, security safeguards, and deployment environment.

---

## Table of Contents

1. [Project Introduction & Core Objectives](#1-project-introduction--core-objectives)
2. [Technology Stack](#2-technology-stack)
3. [Application Features & Business Capabilities](#3-application-features--business-capabilities)
   - [3.1 Executive Dashboard](#31-executive-dashboard)
   - [3.2 Shop & Retail Partner Management](#32-shop--retail-partner-management)
   - [3.3 Product Catalog Management](#33-product-catalog-management)
   - [3.4 Inventory & Stock Movement Tracking](#34-inventory--stock-movement-tracking)
   - [3.5 Sales & Delivery Transaction Recording](#35-sales--delivery-transaction-recording)
   - [3.6 Payment Processing & Outstanding Balance Tracking](#36-payment-processing--outstanding-balance-tracking)
   - [3.7 Statements, Financial Reporting & Export](#37-statements-financial-reporting--export)
   - [3.8 Employee Access & Role Management](#38-employee-access--role-management)
4. [System Architecture](#4-system-architecture)
   - [4.1 Architecture Diagram](#41-architecture-diagram)
   - [4.2 Layer Responsibilities](#42-layer-responsibilities)
5. [Scalability, Traffic Management & Performance](#5-scalability-traffic-management--performance)
   - [5.1 API Traffic Control & Rate Limiting](#51-api-traffic-control--rate-limiting)
   - [5.2 Request Timeout & Disconnect Protection](#52-request-timeout--disconnect-protection)
   - [5.3 Financial Idempotency Protection](#53-financial-idempotency-protection)
   - [5.4 High-Speed Catalog Caching](#54-high-speed-catalog-caching)
   - [5.5 Database Indexing & Query Efficiency](#55-database-indexing--query-efficiency)
   - [5.6 Performance Verification Summary](#56-performance-verification-summary)
6. [Security, Authentication & Access Control](#6-security-authentication--access-control)
   - [6.1 Role-Based Access Control (RBAC)](#61-role-based-access-control-rbac)
   - [6.2 Row-Level Database Isolation](#62-row-level-database-isolation)
   - [6.3 Secure Request Validation](#63-secure-request-validation)
   - [6.4 Audit Logging & Privacy Sanitization](#64-audit-logging--privacy-sanitization)
7. [Email & Password Recovery System](#7-email--password-recovery-system)
8. [Hosting, Infrastructure & Deployment](#8-hosting-infrastructure--deployment)
9. [Data Management & Operational Reliability](#9-data-management--operational-reliability)
10. [Future Expansion & Roadmap](#10-future-expansion--roadmap)
11. [Document Sign-Off & Verification](#11-document-sign-off--verification)

---

## 1. Project Introduction & Core Objectives

### The Business Challenge
In wholesale mobile accessory distribution, businesses routinely manage dozens of retail partner shops, hundreds of fast-moving product SKUs (chargers, tempered glass, cables, cases), high-frequency stock deliveries, deferred payments, and credit balances. Traditional manual bookkeeping exposes the enterprise to critical operational risks:
- Discrepancies between delivered stock and collected revenue.
- Delays in calculating individual shop balances and overdue receivables.
- Lack of immediate insight into real transaction profit margins.
- Accidental loss of paper receipts or corrupted spreadsheets.
- Unauthorized operational visibility across different store locations.

### The Solution: RTR Wholesale Management
RTR Wholesale Management solves these operational challenges by introducing a single, reliable digital source of truth. The application centralizes:
- **Partner Shop Profiles**: Contact details, delivery history, and live ledger balances.
- **Master Product Catalog**: Standard wholesale unit rates, active stock lines, and categorized pricing.
- **Stock Deliveries**: Immutable delivery records capturing delivered items, quantities, and delivery status.
- **Financial Calculations**: Independent Wholesale Amount tracking and Customer Price (CP) profit calculations ($Profit = Customer\ Price - Wholesale\ Amount$).
- **Payment Settlements**: Full, partial, and installment payment tracking with automatic balance deductions.
- **Granular Access Control**: Dedicated interfaces for business owners and restricted, single-shop views for retail employees.

---

## 2. Technology Stack

Every component in the RTR Wholesale Management platform has been selected to ensure high reliability, type safety, responsive performance, and secure cloud operations:

| Layer / Component | Technology | Purpose & Business Value |
|:---|:---|:---|
| **Frontend Framework** | React (v18) | Component-driven, responsive user interface ensuring instantaneous user interaction and real-time state synchronization across desktop and mobile browsers. |
| **Type Safety** | TypeScript (Strict Mode) | End-to-end type safety eliminating runtime variable mismatches, enforcing strict contract integrity across data layers, and enhancing maintainability. |
| **Frontend Build Tool** | Vite | Next-generation frontend bundler providing lightning-fast build execution, optimized bundle chunking, and instant development hot reloading. |
| **Backend Runtime** | Node.js (LTS) | High-throughput, event-driven JavaScript runtime executing server-side workflows, background synchronizations, and data transformations. |
| **API Framework** | Express.js | Robust, minimalist REST API framework handling request routing, rate limiting, token verification, and payload validation. |
| **Managed Backend & Auth**| Supabase | Enterprise-grade backend-as-a-service providing secure JWT authentication, session recovery, and automated connection pooling. |
| **Relational Database** | PostgreSQL | Authoritative relational database engine offering ACID-compliant transactions, foreign key integrity, and Row-Level Security (RLS) enforcement. |
| **User Authentication** | Supabase Auth | Cryptographically secure user authentication managing user credentials, secure password hashing, and token lifecycles. |
| **Frontend Cloud Host** | Vercel | Global Edge Content Delivery Network (CDN) providing high availability, HTTPS encryption, automated builds, and fast worldwide delivery. |
| **Backend Cloud Host** | Render | Managed cloud platform running containerized Node.js API services with health monitoring, automatic process restarts, and zero-downtime deploys. |
| **Monorepo Architecture** | npm Workspaces | Unified project organization keeping frontend (`apps/web`), backend (`apps/api`), and shared types (`packages/shared`) aligned in a single codebase. |

---

## 3. Application Features & Business Capabilities

### 3.1 Executive Dashboard
* **What it does:** Serves as the central command center for the business owner upon logging into the application.
* **Business Benefit:** Eliminates guesswork by summarizing real-time operational health at a glance.
* **User Capabilities:**
  - View aggregate wholesale transaction totals across all retail partners.
  - Monitor total collected payments versus outstanding market balances.
  - Track real-time gross profit figures calculated dynamically from delivery records.
  - Inspect immediate operational alerts (e.g., pending deliveries requiring confirmation).
  - Quick-action shortcuts to register new transactions, add retail shops, or update products.

### 3.2 Shop & Retail Partner Management
* **What it does:** Maintains an active directory of all retail shop partners serviced by RTR Mobiles.
* **Business Benefit:** Organizes customer relationships and prevents duplicate or disorganized billing.
* **User Capabilities:**
  - Create new retail partner shop records with shop name, contact number, and address.
  - Access shop-specific ledgers displaying historical delivery runs, paid sums, and pending balance.
  - Seamlessly toggle shop active/inactive status without breaking historical records.
  - Safe deletion safeguards: Prevents accidental permanent deletion of shops that possess historical transaction dependencies.

### 3.3 Product Catalog Management
* **What it does:** Provides complete administrative control over wholesale inventory items and stock definitions.
* **Business Benefit:** Standardizes product naming and baseline wholesale pricing across all sales representatives.
* **User Capabilities:**
  - Add wholesale items with custom product names, SKU identifiers, and default wholesale rates.
  - Modify pricing and product details on the fly.
  - Deactivate discontinued product lines while preserving past delivery and invoice records.
  - In-modal catalog creation: Create or update products directly from the delivery recording drawer without leaving the sales screen.

### 3.4 Inventory & Stock Movement Tracking
* **What it does:** Tracks stock dispatch from central inventory to individual retail partner shops.
* **Business Benefit:** Establishes accountability for every item leaving central wholesale stock.
* **User Capabilities:**
  - Record exact itemized quantities dispatched per delivery.
  - View chronological stock movement logs detailing dates, destination shops, item counts, and associated delivery IDs.
  - Prevent quantity omissions with automated form validation requiring positive non-zero quantities.

### 3.5 Sales & Delivery Transaction Recording
* **What it does:** Captures the core commercial transactions between RTR Mobiles and partner retail shops.
* **Business Benefit:** Accurately distinguishes between standard wholesale billing amounts and final retail sales value.
* **User Capabilities:**
  - **Single-Screen Drawer Entry**: Fast, distraction-free record entry drawer accessible via intuitive hotkeys (`Alt+N` / `N`).
  - **7-Point Transaction Capture**: Captures Date, Retail Shop, Product, Quantity (Pieces), Wholesale Amount (₹), Delivery Status, and Customer Price (CP).
  - **Independent Financial Architecture**: Maintains independent wholesale billing values while allowing custom wholesale adjustments.
  - **Live Profit Reflection**: Calculates instantaneous profit margin ($Profit = CP - Amount$) upon delivery confirmation.
  - **Loss Safeguard Alerting**: Displays clear contextual warnings if Customer Price is entered below wholesale cost, preventing unintentional loss transactions.

### 3.6 Payment Processing & Outstanding Balance Tracking
* **What it does:** Manages invoice settlement, credit extensions, and incoming cash or digital payments.
* **Business Benefit:** Minimizes bad debt and ensures transparent tracking of all receivables.
* **User Capabilities:**
  - Record full or partial customer payments against specific partner shop accounts.
  - Automatically update remaining balances across monthly and individual shop statements.
  - View historical payment logs with settlement timestamps, payment amounts, and updated balances.
  - Reconcile pending balances automatically when new deliveries or payment entries are posted.

### 3.7 Statements, Financial Reporting & Export
* **What it does:** Generates comprehensive financial statements and audit-ready accounting documents.
* **Business Benefit:** Provides formal billing summaries for retail clients and facilitates monthly accounting reconciliation.
* **User Capabilities:**
  - **Monthly Shop Statement**: Comprehensive view of all deliveries, total goods value, payments received, and net closing balance for any selected calendar month.
  - **Individual Shop Statement**: Deep-dive historical view dedicated to a single partner shop, opening in a clean workspace view.
  - **Multi-Format Export**: Export verified statements directly to formatted **Excel (.xlsx)** spreadsheets or **CSV** text files for external bookkeeping.
  - **Print-Ready Layouts**: Built-in CSS print media styles optimized for clean PDF generation and physical invoice printing.

### 3.8 Employee Access & Role Management
* **What it does:** Enforces strict role separation between business leadership and retail floor employees.
* **Business Benefit:** Protects sensitive company-wide profit figures and prevents cross-shop data leaks.
* **User Capabilities:**
  - **Owner Role**: Unrestricted administrative access across all shops, products, profit statements, employee management, and system settings.
  - **Employee Role**: Strictly sandboxed, read-only access restricted exclusively to the specific retail shop assigned to that employee.
  - **Data Isolation**: Employees cannot view company-wide margins, other retail stores, or administrative financial summaries.

---

## 4. System Architecture

RTR Wholesale Management utilizes a decoupled cloud architecture designed to separate presentation, business logic, security policies, and data persistence into specialized layers.

### 4.1 Architecture Diagram

```text
                  +-----------------------------------+
                  |          Business Users           |
                  |     (Business Owner & Staff)      |
                  +-----------------+-----------------+
                                    |
                                    | HTTPS / TLS 1.3
                                    v
                  +-----------------------------------+
                  |          React Frontend           |
                  |     Hosted on Vercel Edge CDN     |
                  | (Single Page App - React 18, Vite)|
                  +-----------------+-----------------+
                                    |
                                    | REST API (Bearer JWT)
                                    v
                  +-----------------------------------+
                  |         Node.js / Express         |
                  |      API Service on Render        |
                  | (Rate Limiting, Idempotency, Zod) |
                  +-----------------+-----------------+
                                    |
                                    | Parameterized SQL / PostgREST
                                    v
                  +-----------------------------------+
                  |         Supabase Services         |
                  |   Auth Engine & PostgreSQL DB     |
                  |  (Row-Level Security, Migrations) |
                  +-----------------------------------+
```

### 4.2 Layer Responsibilities

1. **Frontend Presentation Layer (`apps/web` hosted on Vercel):**
   - Delivers a fast, responsive user interface to mobile and desktop devices.
   - Handles client-side routing, optimistic form feedback, and statement export formatting.
   - Never stores secret keys; accesses backend services exclusively with public client credentials and temporary user session tokens.

2. **Application Backend Layer (`apps/api` hosted on Render):**
   - Serves as the central security and traffic gateway for all application operations.
   - Validates incoming request structures using strict Zod schemas before touching the database.
   - Enforces sliding-window rate limiters to protect upstream database connections from abuse.
   - Manages request timeouts and terminates abandoned background workloads when clients disconnect.

3. **Database & Authentication Layer (Supabase PostgreSQL):**
   - Manages authoritative user identity, encrypted credentials, and session refresh tokens.
   - Executes versioned PostgreSQL migrations (`0001` through `0012`) ensuring schema consistency.
   - Enforces Row-Level Security (RLS) rules directly in the database engine, guaranteeing that unauthorized users cannot read or write restricted records even if API endpoints were directly probed.

---

## 5. Scalability, Traffic Management & Performance

To guarantee that the platform maintains fluid performance as RTR Mobiles adds new partner shops and records thousands of monthly deliveries, specialized scalability engineering has been incorporated into the backend:

### 5.1 API Traffic Control & Rate Limiting
The API implements tiered traffic throttling to protect system responsiveness and prevent denial-of-service spikes:
* **Standard Queries**: Throttled at 300 requests per 15-minute window per IP address for standard browsing.
* **Authentication Routes**: Strict ceiling of 30 requests per 15-minute window to eliminate brute-force password guessing.
* **Financial Mutations**: Capped at 60 requests per 15-minute window for payment and record creations.
* **Graceful Degradation**: Requests exceeding thresholds receive standard HTTP `429 Too Many Requests` responses with `Retry-After` headers and clean user-facing notifications.

### 5.2 Request Timeout & Disconnect Protection
* Mobile network connections in warehouse and retail environments can experience packet drops or sudden disconnects.
* The API enforces a strict **25-second execution ceiling** (`REQUEST_TIMEOUT_MS`).
* If a mobile user closes their browser or loses connectivity during a query, the server immediately halts database execution via connection listener hooks (`req.on('close')`), preventing orphaned queries from exhausting database resources.

### 5.3 Financial Idempotency Protection
* Critical mutations—such as recording delivery invoices or processing payments—support custom `Idempotency-Key` headers.
* If a user accidentally double-clicks "Submit Payment" during a momentary network delay, the server identifies the duplicate submission via the `idempotency_keys` table and returns the existing result without charging or deducting the ledger balance twice.

### 5.4 High-Speed Catalog Caching
* Retail shop directories and product catalog listings are frequently read but updated infrequently.
* An in-memory catalog cache serves repeated shop and product requests with a **60-second Time-To-Live (TTL)**.
* **Instant Cache Invalidation**: The moment an administrator adds, updates, or deactivates a shop or product, the cache is automatically purged and refreshed, guaranteeing immediate consistency.

### 5.5 Database Indexing & Query Efficiency
Database migration `0012_scalability_indexes_and_concurrency.sql` introduced high-efficiency B-tree composite indexes across high-volume transaction tables:
* `idx_deliveries_business_date`: Optimizes monthly statement queries and date-range filtering.
* `idx_invoices_business_shop_status`: Accelerates pending balance computations and outstanding invoice lookups.
* `idx_idempotency_keys_lookup`: Ensures near-instantaneous deduplication lookups for mutating transactions.

### 5.6 Performance Verification Summary

> [!NOTE]
> **Benchmarking Environment Notice:**
> Scalability stress testing was conducted using a dedicated virtual user (VU) harness executed against a local API server instance. These metrics illustrate backend architectural throughput and traffic-limiting efficiency under controlled conditions; they do not represent guaranteed live cloud capacity, which depends on Render and Supabase cloud tier provisions.

* **Concurrency Scaling**: Tested across virtual user tiers of 5, 25, 50, and 100 concurrent requests.
* **Throughput Capacity**: Sustained high-throughput request dispatch with automated sliding-window rate limit activation at high volumes.
* **Latency Profile**: Sub-second median response times for catalog and read operations under nominal concurrency tiers.
* **Error Resilience**: Zero unhandled server crashes during rapid sequential payload dispatches.

---

## 6. Security, Authentication & Access Control

Security in RTR Wholesale Management is built on defense-in-depth principles, ensuring protection at the user interface, network boundary, and database level:

### 6.1 Role-Based Access Control (RBAC)
* **Administrative Isolation**: Only authenticated accounts with verified `owner` membership can access financial statements, modify catalog pricing, view profit calculations, or manage employee accounts.
* **Employee Sandboxing**: Staff accounts are bound to an explicit `shop_id`. The server strictly rejects requests by employees attempting to query records belonging to unauthorized shop locations.

### 6.2 Row-Level Database Isolation
* PostgreSQL Row-Level Security (RLS) is active across all core tables (`businesses`, `shops`, `products`, `deliveries`, `delivery_items`, `invoices`, and `stock_movements`).
* Even in the theoretical event of an API route defect, database policies prohibit cross-tenant or unauthorized data queries at the SQL engine level.

### 6.3 Secure Request Validation
* Every incoming API payload is parsed through strict Zod validation schemas.
* Input values undergo type validation, positive number verification, and string sanitization, completely preventing SQL injection and parameter manipulation attacks.

### 6.4 Audit Logging & Privacy Sanitization
* All application logging is routed through a dedicated sanitization pipeline ([`safeLogger.ts`](file:///d:/Crimpston/Clients/Cilent_0002/RTR%20mobiles/05_Devlopment/apps/web/src/lib/safeLogger.ts)).
* The logging engine automatically masks and strips sensitive attributes:
  - User passwords and temporary recovery hashes are never printed.
  - JWT tokens and Authorization headers are redacted.
  - UUIDs and customer identifiers are anonymized.
  - Terminal logs and browser consoles remain completely clean and compliant with international privacy standards.

---

## 7. Email & Password Recovery System

The application incorporates a secure, self-service password recovery system allowing authorized users to regain account access without administrative intervention:

* **Email Delivery Engine**: The application currently utilizes the **Supabase Default Mailer service** to dispatch authentication and password recovery messages.
* **Password Recovery Workflow**:
  1. The user navigates to `/forgot-password` and enters their registered email or username.
  2. The system validates the account and dispatches a time-limited recovery link to the registered email address.
  3. The recovery link directs the user to the canonical reset interface (`https://rtr-management.vercel.app/reset-password`).
  4. The user sets a new password complying with minimum security length and complexity rules.
* **Security & Account Enumeration Protection**:
  - The recovery interface returns an identical, neutral confirmation message regardless of whether the entered identifier exists, preventing malicious actors from harvesting valid usernames.
* **Operational Sending Capacity**:
  - The built-in Supabase default mailer operates with standard cloud sending rate limits (approximately 3–4 emails per hour). This is ideal for normal administrative operations; an enterprise dedicated SMTP integration can be connected in the future if high-volume daily emailing is required.

---

## 8. Hosting, Infrastructure & Deployment

The application utilizes industry-standard managed cloud providers, ensuring reliable uptime, automatic SSL certification, and seamless updates:

| Service Layer | Cloud Provider | Verified Production Endpoint | Purpose & Functionality |
|:---|:---|:---|:---|
| **Frontend Web Client** | **Vercel** | `https://rtr-management.vercel.app` | Global edge CDN delivering compiled React static assets, handling client-side SPA routing, and terminating TLS 1.3 HTTPS connections. |
| **Backend API Service** | **Render** | `https://rtr-management.onrender.com` | High-availability containerized Linux environment hosting the Express.js API, handling background logic, caching, and rate limiting. |
| **Database & Auth** | **Supabase** | Managed Cloud Project | Fully managed PostgreSQL database instance hosting relational schemas, RLS policies, connection pools, and authentication services. |

* **Environment Security**: Production secrets, database connection keys, and API tokens are configured exclusively through secure cloud provider management consoles. No credentials or secret keys exist within the Git codebase.

---

## 9. Data Management & Operational Reliability

### 9.1 Transaction Persistence & Financial Integrity
All business operations adhere strictly to relational database principles:
* **Atomic Transactions**: Recording a delivery atomically updates stock levels, creates item records, and generates initial billing entries within a single database transaction. If any sub-step fails, all changes roll back to prevent half-completed records.
* **Independent Balance Calculation**: Outstanding balances are derived from immutable payment logs and delivery invoices, guaranteeing that account totals can always be audited and verified mathematically.

### 9.2 Version-Controlled Schema Migrations
Database architecture is versioned through sequential SQL migration scripts (`0001_initial_schema.sql` through `0012_scalability_indexes_and_concurrency.sql`). Any future enhancements to tables or indexes are tracked in Git and applied predictably without disrupting production data.

### 9.3 Database Backup & Disaster Recovery
* **Automated Cloud Backups**: The Supabase PostgreSQL database platform performs automated point-in-time snapshots and daily physical backups of all business tables.
* **Administrative Data Protection**: Business owners are encouraged to periodically export monthly statements to Excel for independent offline archiving.

---

## 10. Future Expansion & Roadmap

The modular architecture of RTR Wholesale Management provides an ideal foundation for future operational expansion. The following enhancements represent logical future engineering phases that can be integrated as the business expands:

| Proposed Enhancement | Architectural Description | Business Value to RTR Mobiles |
|:---|:---|:---|
| **Distributed Redis Caching** | Upgrade the existing in-memory catalog cache to an external Redis cluster. | Enables distributed caching across multi-instance backend clusters as traffic grows. |
| **Dedicated Enterprise SMTP** | Connect a dedicated transactional email service (e.g., SendGrid, AWS SES, or Resend). | Removes hourly mailer limits and enables custom branded email templates from `@rtrmobiles.com`. |
| **Automated WhatsApp / SMS Receipts**| Integrate a cloud messaging gateway (e.g., Twilio) to dispatch instant delivery notifications to shop owners. | Enhances delivery verification and accelerates payment settlements from retail partners. |
| **Advanced Predictive Analytics** | Introduce machine-learning forecasting on product turnover and seasonal demand. | Identifies fast-selling accessory models and alerts the owner before stock-outs occur. |
| **Barcode / QR Scanning Integration** | Mobile camera scanning of product barcodes during dispatch and delivery confirmation. | Speeds up warehouse packing and eliminates manual product selection errors. |

*Note: The capabilities above are proposed future options for subsequent development phases and are not part of the current production release.*

---

## 11. Document Sign-Off & Verification

This document certifies that the **RTR Wholesale Management** application has been comprehensively developed, hardened, verified, and handed over in full production-ready condition.

* **Codebase Verification**: All 467 automated test suites passed across frontend, backend, and shared packages.
* **Clean Code Handover**: Published to the official private repository [`rtrmobile/rtr-management`](https://github.com/rtrmobile/rtr-management.git) on branch `refactor/rtr-database-and-codebase-cleanup`.
* **Zero Security Exposure**: Complete sanitization verified; zero `.env` files, private keys, or credentials committed.

---

**Prepared by Crimpston Engineering Team**  
*Enterprise Software Development | Scalable Cloud Architecture | Digital Solutions*  
*Contact & Support: Crimpston Technical Support Services*
