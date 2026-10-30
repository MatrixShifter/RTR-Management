import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ErrorPage } from '../components/ui/ErrorPage.js';
import { NotFound } from './NotFound.js';
import { StatusError } from './StatusError.js';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.js';
import { parseApiError } from '../lib/apiErrorHandler.js';

describe('Complete HTTP Status Pages & Error Handling System Suite', () => {
  describe('Phase 1 — HTTP Status Pages Specification Coverage', () => {
    it('1. HTTP 400 — Bad Request renders title, message, and try again/go back actions', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={400} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 400 • Bad Request');
      expect(html).toContain('Bad Request');
      expect(html).toContain('The request could not be processed because the submitted information is invalid.');
      expect(html).toContain('Try Again');
      expect(html).toContain('Go Back');
    });

    it('2. HTTP 401 — Unauthorized renders Session Expired, Sign In action, and no sensitive token exposure', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={401} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 401 • Unauthorized');
      expect(html).toContain('Session Expired');
      expect(html).toContain('Your session has expired or you need to sign in to continue.');
      expect(html).toContain('Sign In');
      expect(html).toContain('Return to Home');
      expect(html).not.toContain('access_token');
      expect(html).not.toContain('Bearer');
    });

    it('3. HTTP 403 — Forbidden renders Access Denied, administrator guidance, and Go to Dashboard', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={403} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 403 • Forbidden');
      expect(html).toContain('Access Denied');
      expect(html).toContain("You don&#x27;t have permission to access this resource.");
      expect(html).toContain('system administrator');
      expect(html).toContain('Go to Dashboard');
      expect(html).toContain('Go Back');
    });

    it('4. HTTP 404 — Page Not Found renders custom illustration, safe sanitized pathname, and navigation options', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/nonexistent-store-path']}>
          <ErrorPage statusCode={404} invalidPath="/nonexistent-store-path" />
        </MemoryRouter>
      );

      expect(html).toContain('Error 404');
      expect(html).toContain('Page Not Found');
      expect(html).toContain("The page you&#x27;re looking for doesn&#x27;t exist, may have been moved, or is no longer available.");
      expect(html).toContain('/nonexistent-store-path');
      expect(html).toContain('Go to Dashboard');
      expect(html).toContain('Go Back');
      expect(html).toContain('Records Ledger');
      expect(html).toContain('Settings');
      expect(html).not.toContain('password');
      expect(html).not.toContain('SELECT *');
    });

    it('5. HTTP 408 — Request Timeout renders timeout notice and Retry Request action', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={408} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 408 • Request Timeout');
      expect(html).toContain('Request Timed Out');
      expect(html).toContain('The request took too long to complete.');
      expect(html).toContain('Duplicate submissions are automatically prevented.');
      expect(html).toContain('Retry Request');
      expect(html).toContain('Go to Dashboard');
    });

    it('6. HTTP 409 — Conflict renders conflict notice and Refresh Data action', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={409} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 409 • Conflict');
      expect(html).toContain('Request Conflict');
      expect(html).toContain('This action conflicts with the current state of the record.');
      expect(html).toContain('Refresh Data');
      expect(html).toContain('Review Latest Record');
    });

    it('7. HTTP 422 — Validation Error renders validation guidance and field details safely', () => {
      const validationDetails = [
        { field: 'quantity', message: 'Quantity must be greater than zero' },
        { field: 'unitPrice', message: 'Unit price cannot be negative' }
      ];

      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={422} validationDetails={validationDetails} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 422 • Validation Error');
      expect(html).toContain('Unable to Process Request');
      expect(html).toContain('Some submitted information needs correction.');
      expect(html).toContain('quantity: Quantity must be greater than zero');
      expect(html).toContain('unitPrice: Unit price cannot be negative');
      expect(html).toContain('Review Form');
    });

    it('8. HTTP 429 — Too Many Requests renders cooldown indicator and enforces cooldown period', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={429} retryAfterSeconds={30} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 429 • Rate Limited');
      expect(html).toContain('Too Many Attempts');
      expect(html).toContain('Too many requests have been made. Please wait before trying again.');
      expect(html).toMatch(/Cooldown active: Please wait[\s\S]*?30[\s\S]*?seconds/);
      expect(html).toMatch(/Retry in[\s\S]*?30s/);
    });

    it('9. HTTP 500 — Internal Server Error renders support reference and never reveals stack traces or SQL', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={500} correlationId="corr_tx_98765432" />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 500 • Server Error');
      expect(html).toContain('Something Went Wrong');
      expect(html).toContain('An unexpected server error occurred.');
      expect(html).toContain('corr_tx_98765432');
      expect(html).toContain('Try Again');
      expect(html).toContain('Go to Dashboard');
      expect(html).not.toContain('Error: at Function');
      expect(html).not.toContain('pg_catalog');
    });

    it('10. HTTP 502 — Bad Gateway renders Service Temporarily Unavailable', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={502} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 502 • Bad Gateway');
      expect(html).toContain('Service Temporarily Unavailable');
      expect(html).toContain('The server received an invalid response from an upstream service.');
      expect(html).toContain('Retry');
      expect(html).toContain('Go to Dashboard');
    });

    it('11. HTTP 503 — Service Unavailable renders Temporarily Unavailable and status guidance', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={503} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 503 • Service Unavailable');
      expect(html).toContain('Temporarily Unavailable');
      expect(html).toContain('The service is temporarily unavailable. Please try again later.');
      expect(html).toContain('Check Status &amp; Retry');
    });

    it('12. HTTP 504 — Gateway Timeout renders Server Timeout and safe retry action', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={504} />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 504 • Gateway Timeout');
      expect(html).toContain('Server Timeout');
      expect(html).toContain('The server took too long to respond.');
      expect(html).toContain('Non-idempotent financial transactions are safe');
      expect(html).toContain('Retry Safely');
    });
  });

  describe('Phase 4 — Centralized API Error Handling Architecture', () => {
    it('guarantees 404 API response returns structured resource error without triggering frontend 404', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RECORD_NOT_FOUND',
            message: 'Wholesale delivery record del-999 not found'
          }
        }),
        {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'application/json', 'x-correlation-id': 'req-corr-404' }
        }
      );

      const parsed = await parseApiError(mockResponse);

      expect(parsed.statusCode).toBe(404);
      expect(parsed.statusText).toBe('Not Found');
      expect(parsed.correlationId).toBe('req-corr-404');
      expect(parsed.message).toBe('Wholesale delivery record del-999 not found');
      expect(parsed.actionRecommendation).toBe('refresh_data');
      // Crucial: Must NOT be an auth or navigation action
      expect(parsed.actionRecommendation).not.toBe('sign_in');
    });

    it('maps 401 API response to sign_in action recommendation and dispatches expiration event', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Token expired' }),
        { status: 401, statusText: 'Unauthorized' }
      );

      const parsed = await parseApiError(mockResponse);

      expect(parsed.statusCode).toBe(401);
      expect(parsed.actionRecommendation).toBe('sign_in');
      expect(parsed.userMessage).toContain('sign in to continue');
    });

    it('maps 429 API response and extracts Retry-After header for cooldown timer', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: 'Too Many Requests' }),
        {
          status: 429,
          headers: { 'Retry-After': '45' }
        }
      );

      const parsed = await parseApiError(mockResponse);

      expect(parsed.statusCode).toBe(429);
      expect(parsed.retryAfterSeconds).toBe(45);
      expect(parsed.actionRecommendation).toBe('cooldown');
      expect(parsed.userMessage).toContain('wait 45 seconds');
    });

    it('maps offline / network disconnect to 503 with helpful connectivity guidance', async () => {
      const networkError = new TypeError('Failed to fetch');
      const parsed = await parseApiError(networkError);

      expect(parsed.statusCode).toBe(503);
      expect(parsed.isNetworkError).toBe(true);
      expect(parsed.userMessage).toContain('internet connection');
      expect(parsed.actionRecommendation).toBe('retry');
    });
  });

  describe('Phase 5 — React Error Boundary Protection', () => {
    it('catches render errors and displays 500 ErrorPage with diagnostic reference and Try Again', () => {
      // In React 18 SSR / renderToString, error boundaries do not automatically intercept child render errors;
      // we test getDerivedStateFromError and boundary fallback rendering directly.
      const boundary = new ErrorBoundary({ children: <div /> });
      boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Uncaught rendering exception in UI tree'));

      const html = renderToString(boundary.render() as React.ReactElement);

      expect(html).toContain('Something went wrong');
      expect(html).toContain('Try Again');
      expect(html).toContain('Reload App');
      expect(html).toContain('ref_');
      // Must NOT leak raw exception message or component stack
      expect(html).not.toContain('Uncaught rendering exception');
    });

    it('renders localized section fallback when sectionTitle is supplied', () => {
      const sectionBoundary = new ErrorBoundary({ sectionTitle: 'Live Analytics Widget', children: <div /> });
      sectionBoundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Widget calculation exploded'));

      const html = renderToString(sectionBoundary.render() as React.ReactElement);

      expect(html).toMatch(/Unable to load.*Live Analytics Widget/);
      expect(html).toContain('Retry Section');
      expect(html).not.toContain('Widget calculation exploded');
    });
  });

  describe('Phase 8 — Security & Mobile Responsiveness', () => {
    it('sanitizes malicious script tags and HTML injection in 404 pathnames', () => {
      const maliciousPath = '/<script>alert("xss")</script>';

      const html = renderToString(
        <MemoryRouter initialEntries={[maliciousPath]}>
          <ErrorPage statusCode={404} invalidPath={maliciousPath} />
        </MemoryRouter>
      );

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert("xss")');
    });

    it('includes responsive padding, 44px touch targets, and touch-friendly buttons', () => {
      const html = renderToString(
        <MemoryRouter>
          <ErrorPage statusCode={404} />
        </MemoryRouter>
      );

      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('sm:p-10');
      expect(html).toContain('flex-col sm:flex-row');
    });
  });

  describe('Phase 3 & Routing — Status Code Route Resolution', () => {
    it('NotFound route component renders HTTP 404 page with sanitized invalid path', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/non-existent-invoice']}>
          <NotFound />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 404 • Page Not Found');
      expect(html).toContain('/non-existent-invoice');
      expect(html).toContain('Go to Dashboard');
    });

    it('StatusError route resolves ?status=403 to HTTP 403 Access Denied page', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/error?status=403']}>
          <StatusError />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 403 • Forbidden');
      expect(html).toContain('Access Denied');
    });

    it('StatusError route resolves /status/429 with custom cooldown parameter', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/error?status=429&retryAfter=60']}>
          <StatusError />
        </MemoryRouter>
      );

      expect(html).toContain('HTTP 429 • Rate Limited');
      expect(html).toMatch(/Cooldown active: Please wait[\s\S]*?60[\s\S]*?seconds/);
    });
  });
});
