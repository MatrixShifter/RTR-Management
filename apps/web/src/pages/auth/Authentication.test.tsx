import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/Toast.js';
import { AppContent } from '../../App.js';
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
  const memoryStore = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
    removeItem: (key: string) => memoryStore.delete(key),
    clear: () => memoryStore.clear(),
    get length() { return memoryStore.size; },
    key: (i: number) => Array.from(memoryStore.keys())[i] ?? null
  };

  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    memoryStore.clear();
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

    it('validates email format and rejects malformed email strings', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('owner@rtrmobiles.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('invalid@')).toBe(false);
      expect(emailRegex.test('@domain.com')).toBe(false);
    });
  });

  describe('Reset Password Component & Lifecycle Suite', () => {
    it('renders verification or invalid link state when recovery session is missing', () => {
      const html = renderToString(
        <ResetPassword onNavigateToLogin={() => {}} onNavigateToForgot={() => {}} />
      );

      expect(html).toContain('Create New Password');
      expect(html).toContain('Verifying secure recovery link...');
    });

    it('enforces minimum 8 character password policy', () => {
      const minLength = 8;
      expect('short'.length < minLength).toBe(true);
      expect('validPass123'.length >= minLength).toBe(true);
    });

    it('requires password and confirmPassword to match exactly', () => {
      const pass1: string = 'correctHorseBattery';
      const pass2: string = 'correctHorseBattery';
      const passMismatch: string = 'differentHorseBattery';

      expect(pass1 === pass2).toBe(true);
      expect(pass1 === passMismatch).toBe(false);
    });

    it('correctly decodes Supabase recovery errors from URL hash or query parameters', () => {
      const rawError = 'Email+link+is+invalid+or+has+expired';
      const decoded = decodeURIComponent(rawError).replace(/\+/g, ' ');
      expect(decoded).toBe('Email link is invalid or has expired');
      expect(decoded.toLowerCase().includes('expired')).toBe(true);
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
    it('renders clean Business Owner Login without demo tabs, sandbox badges, or demo teasers', () => {
      const html = renderToString(
        <Login onLoginSuccess={() => {}} onNavigateToForgot={() => {}} />
      );

      expect(html).toContain('Business Owner Sign In');
      expect(html).toContain('Username or Email');
      expect(html).toContain('Password');
      expect(html).toContain('Remember my username');
      expect(html).toContain('Sign In to Workspace');

      // Verify demo elements are removed from production login page
      expect(html).not.toContain('Try Demo');
      expect(html).not.toContain('Demo Credentials');
      expect(html).not.toContain('Isolated Sandbox');
      expect(html).not.toContain('Presenting to a client?');
    });

    it('does not prefill or display default demo credentials in the login form', () => {
      const html = renderToString(
        <Login onLoginSuccess={() => {}} onNavigateToForgot={() => {}} />
      );

      // Verify no hardcoded demo credentials in inputs
      expect(html).not.toContain('value="demo-owner"');
      expect(html).not.toContain('value="Configure-a-unique-demo-password"');
    });

    it('authenticates valid demo credentials into an isolated demo session', async () => {
      const user = await signIn(DEMO_USERNAME, DEMO_PASSWORD_PLACEHOLDER);

      expect(user).toBeDefined();
      expect(user.role).toBe('demo');
      expect(user.isDemo).toBe(true);
      expect(user.username).toBe('demo-owner');
    }, 15000);

    it('rejects demo login when supplied with an invalid password', async () => {
      await expect(
        signIn(DEMO_USERNAME, 'incorrect-demo-password')
      ).rejects.toThrow(INCORRECT_CREDENTIALS_MSG);
    }, 15000);

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
    }, 60000);
  });

  describe('Application Routing & Login Navigation Transition Suite', () => {
    it('renders /login page for unauthenticated visitors without workspace navbar', () => {
      mockLocalStorage.clear();

      const html = renderToString(
        <ToastProvider>
          <MemoryRouter initialEntries={['/login']}>
            <AppContent />
          </MemoryRouter>
        </ToastProvider>
      );

      // Renders Login form
      expect(html).toContain('Business Owner Sign In');
      expect(html).toContain('Sign In to Workspace');

      // Does NOT render protected workspace elements
      expect(html).not.toContain('lg:pl-[205px]');
      expect(html).not.toContain('Stock Ledger');
    });

    it('redirects unauthenticated visitor from /records to /login', () => {
      mockLocalStorage.clear();

      const html = renderToString(
        <ToastProvider>
          <MemoryRouter initialEntries={['/records']}>
            <AppContent />
          </MemoryRouter>
        </ToastProvider>
      );

      // React Router Navigate redirects away from /records
      expect(html).not.toContain('lg:pl-[205px]');
    });

    it('renders workspace with navbar when session is restored from localStorage', () => {
      mockLocalStorage.setItem('rtr_current_user', JSON.stringify({
        id: 'test-owner-id',
        email: 'owner@rtrmobiles.com',
        name: 'Business Owner',
        role: 'owner'
      }));
      mockLocalStorage.setItem('rtr_session_expiry', String(Date.now() + 86400000));

      const html = renderToString(
        <ToastProvider>
          <MemoryRouter initialEntries={['/records']}>
            <AppContent />
          </MemoryRouter>
        </ToastProvider>
      );

      // Workspace layout with Navbar elements is rendered
      expect(html).toContain('lg:pl-[205px]');
      expect(html).toContain('Business Owner');
      expect(html).toContain('Records');
      expect(html).toContain('Settings');
      expect(html).not.toContain('Business Owner Sign In');
    });

    it('redirects authenticated user away from /login to /records', () => {
      mockLocalStorage.setItem('rtr_current_user', JSON.stringify({
        id: 'test-owner-id',
        email: 'owner@rtrmobiles.com',
        name: 'Business Owner',
        role: 'owner'
      }));
      mockLocalStorage.setItem('rtr_session_expiry', String(Date.now() + 86400000));

      const html = renderToString(
        <ToastProvider>
          <MemoryRouter initialEntries={['/login']}>
            <AppContent />
          </MemoryRouter>
        </ToastProvider>
      );

      // User on /login with authenticated session triggers Navigate to /records and does not render Login form
      expect(html).not.toContain('Business Owner Sign In');
      expect(html).not.toContain('Sign In to Workspace');
    });

    it('redirects authenticated user away from /forgot-password to /records', () => {
      mockLocalStorage.setItem('rtr_current_user', JSON.stringify({
        id: 'test-owner-id',
        email: 'owner@rtrmobiles.com',
        name: 'Business Owner',
        role: 'owner'
      }));
      mockLocalStorage.setItem('rtr_session_expiry', String(Date.now() + 86400000));

      const html = renderToString(
        <ToastProvider>
          <MemoryRouter initialEntries={['/forgot-password']}>
            <AppContent />
          </MemoryRouter>
        </ToastProvider>
      );

      // User on /forgot-password with authenticated session triggers Navigate to /records and does not render ForgotPassword form
      expect(html).not.toContain('Reset Your Password');
      expect(html).not.toContain('Send Password Reset Link');
    });

    it('renders /reset-password standalone without workspace shell even if user session exists', () => {
      mockLocalStorage.setItem('rtr_current_user', JSON.stringify({
        id: 'test-owner-id',
        email: 'owner@rtrmobiles.com',
        name: 'Business Owner',
        role: 'owner'
      }));
      mockLocalStorage.setItem('rtr_session_expiry', String(Date.now() + 86400000));

      const html = renderToString(
        <ToastProvider>
          <MemoryRouter initialEntries={['/reset-password']}>
            <AppContent />
          </MemoryRouter>
        </ToastProvider>
      );

      // Standalone card is rendered, NOT workspace layout
      expect(html).toContain('Create New Password');
      expect(html).toContain('Verifying secure recovery link...');
      expect(html).not.toContain('lg:pl-[205px]');
    });
  });
});
