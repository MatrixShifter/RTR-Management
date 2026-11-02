# RTR Wholesale Management — Email Branding & Custom SMTP Configuration Guide

This guide details how to configure custom SMTP delivery, DNS authentication records, and production-branded email templates in the Supabase Dashboard for RTR Wholesale Management.

---

## 1. Supabase Dashboard — Email Templates Setup

In the [Supabase Dashboard](https://supabase.com/dashboard/project/lwyxzmrxxviiuzztpwar):
Navigate to **Authentication** &rarr; **Email Templates**.

### Template 1: Magic Link / OTP (Employee Passwordless Sign-In)
- **Target Template in Dashboard:** `Magic Link`
- **Subject:** `Your RTR Wholesale Management Verification Code`
- **Body:** Copy and paste the HTML content from [`magic-link-otp.html`](./magic-link-otp.html).
- **Plain Text Fallback:** Copy content from [`magic-link-otp.txt`](./magic-link-otp.txt).
- **Key Variables:** Uses `{{ .Token }}` for the prominent 6-digit numeric OTP that employees enter on the Employee Login screen, and `{{ .ConfirmationURL }}` for optional direct sign-in.

### Template 2: Reset Password (Owner Password Recovery)
- **Target Template in Dashboard:** `Reset Password`
- **Subject:** `Reset Your RTR Wholesale Management Password`
- **Body:** Copy and paste the HTML content from [`reset-password.html`](./reset-password.html).
- **Plain Text Fallback:** Copy content from [`reset-password.txt`](./reset-password.txt).
- **Key Variable:** Uses `{{ .ConfirmationURL }}` directing the owner to `https://rtr-management-cfn4.vercel.app/reset-password`.

### Template 3: Invite User (Employee Invitations & Onboarding)
- **Target Template in Dashboard:** `Invite User`
- **Subject:** `Welcome to RTR Wholesale Management — Your Employee Account`
- **Body:** Copy and paste the HTML content from [`employee-onboarding.html`](./employee-onboarding.html) (or [`invite-user.html`](./invite-user.html)).
- **Plain Text Fallback:** Copy content from [`employee-onboarding.txt`](./employee-onboarding.txt).
- **Key Variable:** Uses `{{ .ConfirmationURL }}` and `{{ .Email }}`.

### Template 4: Confirm Signup (Account Confirmation)
- **Target Template in Dashboard:** `Confirm Signup`
- **Subject:** `Confirm Your RTR Wholesale Management Account`
- **Body:** Copy and paste the HTML content from [`confirm-signup.html`](./confirm-signup.html).
- **Plain Text Fallback:** Copy content from [`confirm-signup.txt`](./confirm-signup.txt).

### Template 5: Change Email Address (Email Update Confirmation)
- **Target Template in Dashboard:** `Change Email Address`
- **Subject:** `Confirm Email Address Change — RTR Wholesale Management`
- **Body:** Copy and paste the HTML content from [`change-email.html`](./change-email.html).
- **Plain Text Fallback:** Copy content from [`change-email.txt`](./change-email.txt).

---

## 2. Supabase Auth — OTP & Expiration Settings

In the [Supabase Dashboard](https://supabase.com/dashboard/project/lwyxzmrxxviiuzztpwar):
Navigate to **Authentication** &rarr; **URL Configuration** and **Authentication** &rarr; **Email Auth**:

1. **OTP Code Expiry:**
   - Set **OTP Expiry**: `300` seconds (5 minutes) to ensure one-time codes expire quickly for high security.
2. **OTP Code Length:**
   - Set **OTP Length**: `6` digits.
3. **Redirect URLs (Allowlist):**
   - Add your production URLs:
     - `https://rtr-management-cfn4.vercel.app`
     - `https://rtr-management-cfn4.vercel.app/login`
     - `https://rtr-management-cfn4.vercel.app/reset-password`
   - Add your local development URLs:
     - `http://localhost:5173`
     - `http://localhost:5173/login`
     - `http://localhost:5173/reset-password`

---

## 3. Custom SMTP Provider Configuration

By default, Supabase sends transactional emails using its shared rate-limited sender (`noreply@mail.app.supabase.io`). This shared mailer enforces a hard limit of **~3-4 emails per hour** per project. Any further emails trigger `over_email_send_rate_limit` (HTTP 429).

To send unlimited branded emails directly to user inboxes:

Navigate to **Authentication** &rarr; **SMTP Settings** in the Supabase Dashboard:

1. Toggle **Enable Custom SMTP** to `ON`.
2. Enter the parameters from your transactional email provider:

| Setting | Recommended Value | Example (Resend) | Example (SendGrid) | Example (Postmark) |
| :--- | :--- | :--- | :--- | :--- |
| **Sender Email** | `no-reply@YOUR_VERIFIED_DOMAIN` | `no-reply@rtrmobiles.com` | `no-reply@rtrmobiles.com` | `no-reply@rtrmobiles.com` |
| **Sender Name** | `RTR Wholesale Management` | `RTR Wholesale Management` | `RTR Wholesale Management` | `RTR Wholesale Management` |
| **SMTP Host** | Provider SMTP host | `smtp.resend.com` | `smtp.sendgrid.net` | `smtp.postmarkapp.com` |
| **SMTP Port** | `587` (TLS) or `465` (SSL) | `587` | `587` | `587` |
| **SMTP User** | Provider username | `resend` | `apikey` | Your Postmark Server Token |
| **SMTP Password** | Provider API key / password | `re_YourSecretKeyHere` | `SG.YourSecretKeyHere` | Your Postmark Server Token |

> [!IMPORTANT]
> Never commit actual SMTP passwords, API keys, or provider tokens to Git or place them in frontend environment variables. All SMTP credentials reside securely within the Supabase Dashboard.

---

## 4. Domain Authentication (DNS Records)

To guarantee deliverability and prevent emails from landing in spam or being rejected, configure the following DNS records in your domain registrar (e.g. Cloudflare, GoDaddy, Namecheap):

### 1. SPF (Sender Policy Framework)
- **Type:** `TXT`
- **Name:** `@` (or your subdomain, e.g. `mail`)
- **Value:** `v=spf1 include:<provider-spf> ~all`
  - *Resend:* `v=spf1 include:amazonses.com ~all`
  - *SendGrid:* `v=spf1 include:sendgrid.net ~all`
  - *Postmark:* `v=spf1 include:spf.mtasv.net ~all`

### 2. DKIM (DomainKeys Identified Mail)
- Configure the CNAME or TXT records generated by your SMTP provider dashboard (e.g. `resend._domainkey` or `s1.domainkey`).

### 3. DMARC (Domain-based Message Authentication, Reporting, and Conformance)
- **Type:** `TXT`
- **Name:** `_dmarc`
- **Value:** `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@YOUR_VERIFIED_DOMAIN; pct=100; adkim=r; aspf=r`
