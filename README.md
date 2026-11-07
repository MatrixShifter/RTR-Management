# RTR Wholesale Management System

**Client:** RTR Mobiles  
**Developed by:** Crimpston  
**Project Type:** Wholesale Inventory and Business Management Application  
**Status:** Production

---

## 1. Project Overview

RTR Wholesale Management is a web-based application developed to simplify wholesale business operations, inventory tracking, shop-wise sales management, delivery tracking, and payment monitoring.

The application helps business owners maintain accurate records of stock movements, monitor shop transactions, track pending payments, and review business performance through a centralized dashboard.

## 2. Key Features

- **Dashboard:** View important business information and operational summaries.
- **Shop Management:** Manage shops and access shop-specific records.
- **Product Management:** Maintain product information and inventory.
- **Stock Management:** Record stock deliveries, sales, and quantity changes.
- **Delivery Tracking:** Monitor delivered quantities and remaining stock.
- **Sales Tracking:** Record sales and track shop-wise transactions.
- **Payment Management:** Track paid, partially paid, and pending amounts.
- **Historical Records:** Search and review previous business transactions.
- **Business Reports:** Review shop-wise activity and business performance.
- **Authentication:** Secure access to authorized application users.

*Feature availability depends on the deployed application version and configured permissions.*

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript |
| Build Tool | Vite |
| Backend | Node.js, Express |
| Database | Supabase |
| Authentication | Supabase Auth |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Package Management | npm |
| Architecture | Monorepo |

## 4. Project Architecture

The project follows a monorepo structure.

```text
RTR-Management/
│
├── apps/
│   ├── web/              # React frontend
│   │   ├── src/
│   │   ├── api/          # Serverless API functions
│   │   └── package.json
│   │
│   └── api/              # Express backend
│       ├── src/
│       └── package.json
│
├── packages/
│   └── shared/           # Shared application code
│
├── package.json
└── README.md
```

The frontend communicates with the backend API and Supabase services. The backend handles server-side operations and database access.

## 5. Prerequisites

Before setting up the project, install:

- Node.js (LTS version recommended)
- npm
- Git
- Access to the authorized Supabase project
- Access to the required deployment environments

## 6. Local Development Setup

### Step 1: Clone the repository

```bash
git clone <CLIENT_REPOSITORY_URL>
cd RTR-Management
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Configure environment variables

Create the required environment files using the project's environment variable examples or deployment configuration.

Do not commit actual credentials or secret values.

### Frontend environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public/anon key |
| `VITE_OWNER_EMAIL` | Configured owner email |

### Backend environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `HOST` | Server host configuration |
| `NODE_ENV` | Runtime environment |
| `CORS_ORIGIN` | Allowed frontend origin |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-side Supabase key |
| `OWNER_EMAIL` | Configured owner email |

**Security:** The service-role key must remain server-side. Never expose it through frontend variables, source code, screenshots, logs, or Git commits.

### Step 4: Build shared package

```bash
npm run build:shared
```

### Step 5: Start the frontend

Follow the scripts defined in `apps/web/package.json`.

### Step 6: Start the backend

Follow the scripts defined in `apps/api/package.json`.

Refer to the package scripts before running development commands.

## 7. Production Deployment

The application uses separate hosting services for the frontend and backend.

### Frontend — Vercel

- Hosting provider: Vercel
- Production URL: https://rtr-management.vercel.app/login
- Root directory: `apps/web`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Backend — Render

- Hosting provider: Render
- Service URL: https://rtrmanagement.onrender.com
- Runtime: Node.js
- Build command:

```bash
npm install && npm run build:shared && npm run build --workspace=@crimpston/api
```

- Start command:

```bash
npm run start --workspace=@crimpston/api
```

Deployment configuration should be verified against the current hosting dashboards before making production changes.

## 8. Database and Data Management

The application uses Supabase for database and authentication services.

Important operational practices:

- Maintain backups of production data.
- Apply database schema changes through reviewed migrations.
- Validate changes in a development environment before production.
- Protect business and customer information.
- Avoid manually modifying production records without authorization.
- Ensure frontend and backend connect to the same intended production Supabase project.

## 9. Security Guidelines

Security is a priority for this application.

- Never commit `.env` files or credentials.
- Never expose service-role keys in frontend code.
- Use environment variables for configuration.
- Keep authentication and authorization checks on the server where required.
- Restrict access according to user roles.
- Validate and sanitize incoming data.
- Avoid logging passwords, tokens, session data, API keys, or sensitive business information.
- Return safe error messages to frontend users.
- Review dependencies and security updates regularly.

If a credential is accidentally exposed, rotate it immediately.

## 10. Git Workflow

Recommended workflow for future development:

1. Create a separate feature or bug-fix branch.
2. Implement the changes.
3. Test locally.
4. Review the code and security implications.
5. Commit with a meaningful message.
6. Push the branch.
7. Review and merge through a pull request.
8. Deploy after approval.

Example:

```bash
git checkout -b feature/feature-name
git add .
git commit -m "feat: describe the change"
git push origin feature/feature-name
```

Avoid committing directly to the production branch without the client's approval.

## 11. Maintenance and Support

Recommended maintenance activities:

- Monitor frontend and backend deployment health.
- Review application errors and sanitized server logs.
- Maintain database backups.
- Review user access and permissions.
- Test important business workflows after releases.
- Keep dependencies updated.
- Document significant database and application changes.

## 12. Project Ownership and Handover

The client repository and production infrastructure should remain under the client's authorized accounts.

The client should maintain access to:

- Source code repository.
- Vercel project.
- Render service.
- Supabase project.
- Production domain and DNS configuration, where applicable.

Crimpston developed the application and may provide maintenance or further development according to the agreed service arrangement.

## 13. Important Notes

- Do not use production credentials in development environments.
- Do not modify production database configuration without authorization.
- Do not deploy untested changes.
- Do not share credentials through GitHub, email, or public communication channels.
- Verify environment variables before deployment.

---

**Developed by Crimpston**  
*Software Development & Digital Solutions*

