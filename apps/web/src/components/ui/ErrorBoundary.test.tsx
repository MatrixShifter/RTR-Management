import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary.js';

// Component that throws on render for testing the boundary
const CrashingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Database connection failed: SELECT * FROM sensitive_owner_credentials WHERE secret = 123');
  }
  return <div data-testid="healthy-content">Healthy Application Content</div>;
};

describe('ErrorBoundary Component — Production-Safe Error Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children normally when no error occurs', () => {
    const html = renderToString(
      <ErrorBoundary>
        <CrashingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(html).toContain('Healthy Application Content');
    expect(html).not.toContain('Something went wrong');
  });

  it('catches render exceptions and displays the secure, user-friendly fallback', () => {
    // Suppress console.error during expected throw
    vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderToString(
        <ErrorBoundary>
          <CrashingComponent shouldThrow={true} />
        </ErrorBoundary>
      );
    } catch {
      // In SSR / renderToString, error boundaries may let error bubble or require instance testing
    }

    // Direct instance verification for client-side behavior
    const boundary = new ErrorBoundary({ children: <CrashingComponent shouldThrow={true} /> });
    const errorState = ErrorBoundary.getDerivedStateFromError(new Error('Sensitive database exception'));
    
    boundary.state = errorState;
    const fallbackHtml = renderToString(boundary.render() as React.ReactElement);

    // Required user-friendly title and message
    expect(fallbackHtml).toContain('Something went wrong');
    expect(fallbackHtml).toContain("couldn&#x27;t load this page. Please try again. If the problem continues, contact support.");

    // Action buttons
    expect(fallbackHtml).toContain('Try Again');
    expect(fallbackHtml).toContain('Reload App');

    // Reference ID present
    expect(fallbackHtml).toContain('Reference:');

    // SECURITY ASSERTIONS: Ensure zero sensitive details in UI
    expect(fallbackHtml).not.toContain('Sensitive database exception');
    expect(fallbackHtml).not.toContain('SELECT * FROM');
    expect(fallbackHtml).not.toContain('sensitive_owner_credentials');
    expect(fallbackHtml).not.toContain('componentStack');
    expect(fallbackHtml).not.toContain('View component trace');
    expect(fallbackHtml).not.toContain('TypeError');
    expect(fallbackHtml).not.toContain('useContext');
  });

  it('generates a non-sensitive reference ID starting with ref_', () => {
    const errorState = ErrorBoundary.getDerivedStateFromError(new Error('Sample test error'));
    expect(errorState.hasError).toBe(true);
    expect(errorState.referenceId).toBeDefined();
    expect(errorState.referenceId).toMatch(/^ref_/);
  });

  it('logs error details safely to console.error during componentDidCatch without crashing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const boundary = new ErrorBoundary({ children: <div /> });
    boundary.state = { hasError: true, referenceId: 'ref_test123' };

    const testError = new Error('Test rendering crash');
    const errorInfo = { componentStack: '\n    in CrashingComponent\n    in ErrorBoundary' };

    boundary.componentDidCatch(testError, errorInfo);

    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall).toBeDefined();
    expect(logCall![0]).toContain('[Application Error] Reference ID: ref_test123');
  });

  it('ensures production error logging omits component traces and raw stack traces', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const boundary = new ErrorBoundary({ children: <div /> });
      boundary.state = { hasError: true, referenceId: 'ref_prod_123' };

      const testError = new Error('Database password leak attempt');
      const errorInfo = { componentStack: '\n    in SecretComponent\n    in InternalApp' };

      boundary.componentDidCatch(testError, errorInfo);

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls;
      const allLoggedText = JSON.stringify(calls);
      expect(allLoggedText).not.toContain('SecretComponent');
      expect(allLoggedText).not.toContain('Database password leak attempt');
      expect(allLoggedText).not.toContain('componentStack');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});
