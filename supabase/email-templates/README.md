# RTR Wholesale Management — Email Branding & Supabase Default Mailer Setup Guide

This guide details how to install and synchronize our professional, custom-branded RTR Wholesale Management email templates directly into the **Supabase Dashboard** using Supabase's built-in default email service (Custom SMTP remains disabled).

---

## 1. Supabase Dashboard — Email Templates Setup

All transactional emails use Supabase's built-in default mail service. By adding our custom HTML and plain-text templates to the Supabase Dashboard, every authentication email sent to owners and employees reflects official RTR Wholesale Management branding without requiring a third-party SMTP provider.

In the [Supabase Dashboard](https://supabase.com/dashboard/project/lwyxzmrxxviiuzztpwar):
Navigate to **Authentication** &rarr; **Email Templates**.

### Template 1: Magic Link / OTP (Employee Passwordless Sign-In)
- **Target Template in Dashboard:** `Magic Link`
- **Subject:** `Your RTR Wholesale Management Verification Code`
- **Body:** Copy and paste the HTML content from [`magic-link-otp.html`](./magic-link-otp.html).
- **Plain Text Fallback:** Copy content from [`magic-link-otp.txt`](./magic-link-otp.txt).
- **Key Variables:** Uses `{{ .Token }}` for the prominent 6-digit numeric OTP code that employees enter on the Employee Login screen, and `{{ .ConfirmationURL }}` for optional direct sign-in.

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

## 3. Supabase Default Mailer Rate Limits & Behavior

Because Custom SMTP is disabled and no custom sending domain is used:

1. **Sender Address:**
   - Emails are delivered from Supabase's default mailer pool (`noreply@mail.app.supabase.io`).
2. **Rate Limit:**
   - Supabase's default mailer pool enforces a rate limit of **~3-4 emails per hour per project**.
   - If more than 3-4 emails are triggered within a 1-hour window, Supabase returns HTTP 429 (`over_email_send_rate_limit`).
   - The application gracefully catches this 429 response and informs the user to wait a few minutes before requesting another verification code.
3. **Security:**
   - Unknown emails attempting OTP login are rejected with `422 Signups not allowed for otp` (`shouldCreateUser: false`), completely preventing unauthorized account creation and enumeration.
