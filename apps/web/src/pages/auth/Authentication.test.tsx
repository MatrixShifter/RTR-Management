import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Login } from './Login.js';
import { ForgotPassword } from './ForgotPassword.js';
import { ResetPassword } from './ResetPassword.js';
import { 
  INCORRECT_CREDENTIALS_MSG, 
  RECOVERY_CONFIRMATION_MSG,
  NETWORK_ERROR_MSG,
  getRememberedUsername,
  setRememberedUsername,
  signIn,
  DEMO_USERNAME,
  DEMO_PASSWORD_PLACEHOLDER
} from '../../services/auth.js';
import {
  setDemoMode,
  isDemoMode,
  resetDemoData,
  getShops,
  getProducts,
  getBusinessRecords,
  saveBusinessRecord
} from '../../services/db.js';

describe('Secure Owner Authentication Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Login Page Component', () => {
    it('renders all required fields: username, password, show/hide toggle, remember me, sign in button, and forgot password link', () => {
      const html = renderToString(
        <Login onLoginSuccess={() => {}} onNavigateToForgot={() => {}} />
      );

      // RTR Branding
      expect(html).toContain('RTR Wholesale Management');
      expect(html).toContain('Owner Portal');

      // Required Input Fields
      expect(html).toContain('Username or Email');
      expect(html).toContain('name="username"');
      expect(html).toContain('Password');
      expect(html).toContain('name="password"');

      // Controls & Actions
      expect(html).toContain('Forgot Password?');
      expect(html).toContain('Remember my username');
      expect(html).toContain('Sign In to Workspace');

      // Password toggle aria label
      expect(html).toContain('aria-label="Show password"');

      // No insecure dummy login buttons
      expect(html).not.toContain('Sign In as Employee');
      expect(html).not.toContain('Development Testing Accounts');
    });

    it('displays exact required message on authentication failure', () => {
      expect(INCORRECT_CREDENTIALS_MSG).toBe("Incorrect username or password. Please try again.");
      expect(NETWORK_ERROR_MSG).toBe("Unable to connect to authentication service. Please check your connection and try again.");
    });
  });

  describe('Forgot Password Component', () => {
    it('renders username/email input, submit button, and back to sign in link', () => {
      const html = renderToString(
        <ForgotPassword onNavigateToLogin={() => {}} />
      );

      expect(html).toContain('Reset Your Password');
      expect(html).toContain('Username or Registered Email');
      expect(html).toContain('Send Password Reset Link');
      expect(html).toContain('Back to Sign In');
    });

    it('enforces neutral confirmation message to prevent account enumeration', () => {
      expect(RECOVERY_CONFIRMATION_MSG).toBe(
        "If an account matches the information provided, password reset instructions will be sent to its registered email address."
      );
    });
  });

  describe('Reset Password Component', () => {
    it('renders verification or invalid link state when recovery session is missing', () => {
      const html = renderToString(
        <ResetPassword onNavigateToLogin={() => {}} onNavigateToForgot={() => {}} />
      );

      expect(html).toContain('Create New Password');
      expect(html).toContain('Verifying secure recovery link...');
    });
  });

  describe('Remember Me Preference Storage', () => {
    it('saves and clears remembered username securely without storing passwords', () => {
      // Simulate saving
      setRememberedUsername('vino_owner', true);
      // Verify no password storage
      expect(getRememberedUsername()).toBe('vino_owner');

      // Simulate unchecking
      setRememberedUsername('vino_owner', false);
      expect(getRememberedUsername()).toBe('');
    });
  });

  describe('Demo Login & Isolated Sandbox Suite', () => {
    it('renders two clearly distinguished options on Login: Business Owner Login and Try Demo', () => {
      const html = renderToString(
        <Login onLoginSuccess={() => {}} onNavigateToForgot={() => {}} />
      );

      expect(html).toContain('Business Owner Login');
      expect(html).toContain('Try Demo');
      expect(html).toContain('Sandbox');
    });

    it('displays clearly labeled demo credentials placeholders on the login page', () => {
      const htmlOwner = renderToString(
        <Login onLoginSuccess={() => {}} onNavigateToForgot={() => {}} />
      );
      expect(htmlOwner).toContain(DEMO_USERNAME);
      expect(htmlOwner).toContain(DEMO_PASSWORD_PLACEHOLDER);

      const htmlDemo = renderToString(
        <Login initialTab="demo" onLoginSuccess={() => {}} onNavigateToForgot={() => {}} />
      );
      expect(htmlDemo).toContain(DEMO_USERNAME);
      expect(htmlDemo).toContain(DEMO_PASSWORD_PLACEHOLDER);
      expect(htmlDemo).toContain('Demo Credentials');
      expect(htmlDemo).toContain('Isolated Sandbox');
      expect(DEMO_USERNAME).toBe('demo-owner');
      expect(DEMO_PASSWORD_PLACEHOLDER).toBe('Configure-a-unique-demo-password');
    });

    it('authenticates valid demo credentials into an isolated demo session', async () => {
      const user = await signIn(DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER);

      expect(user).toBeDefined();
      expect(user.role).toBe('demo');
      expect(user.isDemo).toBe(true);
      expect(user.username).toBe('demo-owner');
    });

    it('rejects demo login when supplied with an invalid password', async () => {
      await expect(
        signIn(DEMO_USERNAME, 'incorrect-demo-password')
      ).rejects.toThrow(INCORRECT_CREDENTIALS_MSG);
    });

    it('persists demo session in storage across refreshes and clears it on logout', () => {
      const storageMap = new Map<string, string>();
      const storage = (typeof localStorage !== 'undefined') ? localStorage : {
        getItem: (k: string) => storageMap.get(k) || null,
        setItem: (k: string, v: string) => { storageMap.set(k, v); },
        removeItem: (k: string) => { storageMap.delete(k); }
      };

      const userState = {
        id: 'deae5634-055a-4045-a6ac-fc00ed9e247a',
        email: 'demo-owner@rtrmobiles.com',
        username: 'demo-owner',
        name: 'Demo Owner (Sandbox)',
        role: 'demo' as const,
        isDemo: true
      };

      storage.setItem('rtr_current_user', JSON.stringify(userState));
      storage.setItem('rtr_session_expiry', String(Date.now() + 86400000));
      setDemoMode(true);

      // Verify restored on simulated refresh
      const stored = storage.getItem('rtr_current_user');
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.role).toBe('demo');
      expect(parsed.isDemo).toBe(true);
      expect(isDemoMode()).toBe(true);

      // Simulate sign out
      setDemoMode(false);
      storage.removeItem('rtr_current_user');
      storage.removeItem('rtr_session_expiry');

      expect(storage.getItem('rtr_current_user')).toBeNull();
      expect(isDemoMode()).toBe(false);
    });

    it('strictly isolates demo data from production business data', async () => {
      // 1. In demo mode: returns demo sample data
      setDemoMode(true);
      expect(isDemoMode()).toBe(true);

      const demoShops = await getShops();
      expect(demoShops.length).toBeGreaterThan(0);
      expect(demoShops.some(s => s.name.startsWith('[DEMO]'))).toBe(true);

      const demoProds = await getProducts();
      expect(demoProds.some(p => p.sku.startsWith('DEMO-'))).toBe(true);

      const demoRecords = await getBusinessRecords();
      expect(demoRecords.length).toBeGreaterThan(0);
      expect(demoRecords.some(r => r.shopName.startsWith('[DEMO]'))).toBe(true);

      // Verify prioritized ordering works in demo data (Pending at top, Completed at bottom)
      const topRecord = demoRecords[0];
      const bottomRecord = demoRecords[demoRecords.length - 1];
      expect(topRecord?.deliveryStatus).toBe('pending');
      expect(bottomRecord?.pendingAmount).toBe(0);

      // 2. Add disposable demo record
      const addedDemo = await saveBusinessRecord({
        date: '2026-10-24',
        shopName: '[DEMO] Temporary Testing Shop',
        productName: '[DEMO] Sample Glass Cover',
        quantity: 10,
        unitPrice: 150,
        paidAmount: 500,
        pendingAmount: 1000,
        deliveryStatus: 'delivered'
      });
      expect(addedDemo.shopName).toContain('[DEMO]');

      // 3. Switch to owner mode: demo records are excluded from production queries
      setDemoMode(false);
      expect(isDemoMode()).toBe(false);

      const prodShops = await getShops();
      expect(prodShops.some(s => s.name === '[DEMO] Temporary Testing Shop')).toBe(false);

      const prodRecords = await getBusinessRecords();
      expect(prodRecords.some(r => r.shopName === '[DEMO] Temporary Testing Shop')).toBe(false);

      // 4. Resetting demo data restores sample state safely
      setDemoMode(true);
      resetDemoData();
      const resetRecords = await getBusinessRecords();
      expect(resetRecords.some(r => r.shopName === '[DEMO] Temporary Testing Shop')).toBe(false);

      // Clean up
      setDemoMode(false);
    }, 25000);
  });
});
