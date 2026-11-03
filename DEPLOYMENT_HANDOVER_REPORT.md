# RTR Wholesale Management — Deployment & Handover Guide

**Date:** 2026-11-03  
**Status:** Ready for Deployment Verification  
**Authoritative Supabase Project:** `https://xjlnoxbkcyymtdtallzu.supabase.co` (`xjlnoxbkcyymtdtallzu`)  
**Target Repository:** `https://github.com/rtrmobile/rtr-management.git`  
**Target Branch:** `refactor/rtr-database-and-codebase-cleanup`  

---

## 1. Production Architecture Overview

The RTR Wholesale Management application runs in a modern, scalable cloud deployment architecture:

```
                  ┌────────────────────────────────────────┐
                  │          Vercel Production             │
                  │  https://rtr-management.vercel.app     │
                  │                                        │
                  │  - Static SPA: apps/web/dist           │
                  │  - Serverless APIs: apps/web/api/*     │
                  └──────────────────┬─────────────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌────────────────────────────┐              ┌───────────────────────────────────┐
│       Render Backend       │              │     Supabase Authoritative DB     │
│  Node.js / Express API     │              │  xjlnoxbkcyymtdtallzu             │
│  https://...onrender.com   │              │  PostgreSQL + Auth + RLS          │
└────────────────────────────┘              └───────────────────────────────────┘
```

---

## 2. Environment Variables Configuration

Configure the following environment variable names in your cloud deployment dashboards. **Never commit actual secret values into Git.**

### A. Vercel Dashboard (Production Web App)
| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Yes | `https://xjlnoxbkcyymtdtallzu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Production Supabase public anon key |
| `SUPABASE_URL` | Yes | `https://xjlnoxbkcyymtdtallzu.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Production Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY`| Yes | Production Supabase service role secret |
| `OWNER_EMAIL` | Yes | `rtrmobile92@gmail.com` |

### B. Render Dashboard (Production Express API)
| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `4000` (or Render standard port) |
| `CORS_ORIGIN` | Yes | `https://rtr-management.vercel.app` (or client custom domain) |
| `SUPABASE_URL` | Yes | `https://xjlnoxbkcyymtdtallzu.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Production Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY`| Yes | Production Supabase service role secret |
| `OWNER_EMAIL` | Yes | `rtrmobile92@gmail.com` |

---

## 3. Vercel Deployment Settings

- **Framework Preset:** Vite
- **Root Directory:** `apps/web` (or root with workspace build)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js Version:** 20.x or 22.x

---

## 4. Render Deployment Settings

- **Environment:** Node
- **Build Command:** `npm run build --workspace=@crimpston/shared && npm run build --workspace=@crimpston/api`
- **Start Command:** `npm run start --workspace=@crimpston/api` (runs `node dist/server.js`)
- **Health Check Path:** `/api/health`

---

## 5. Pre-Deployment Verification Checklist

- [x] All 416 unit and integration tests passing (`npm test`).
- [x] Production build passes cleanly with zero errors (`npm run build`).
- [x] Deprecated development project references removed and blocked.
- [x] Multi-tenant isolation verified with RLS.
- [x] Permanent owner profile and business membership configured.
- [x] Employee single-shop read-only permissions enforced.
- [ ] Environment variables configured in Vercel and Render dashboards.
- [ ] Push to client repository approved.
