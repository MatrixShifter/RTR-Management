import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './pages/NotFound.js';

describe('RTR Wholesale Management — Brand & App Identity Verification', () => {
  it('verifies index.html uses RTR Wholesale Management as title', () => {
    const indexPath = resolve(__dirname, '../index.html');
    const html = readFileSync(indexPath, 'utf-8');
    expect(html).toContain('<title>RTR Wholesale Management</title>');
    expect(html).not.toContain('<title>Crimpston');
  });

  it('verifies PWA manifest exists and specifies RTR Wholesale Management', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.name).toBe('RTR Wholesale Management');
    expect(manifest.short_name).toBe('RTR Wholesale');
  });

  it('verifies brand icon SVG exists in public directory', () => {
    const iconPath = resolve(__dirname, '../public/icon.svg');
    expect(existsSync(iconPath)).toBe(true);
    const svg = readFileSync(iconPath, 'utf-8');
    expect(svg).toContain('RTR');
  });
});

describe('SPA Fallback Routing & Vercel Deployment Configuration', () => {
  it('verifies apps/web/vercel.json exists with SPA fallback rewrite to index.html', () => {
    const vercelConfigPath = resolve(__dirname, '../vercel.json');
    expect(existsSync(vercelConfigPath)).toBe(true);

    const config = JSON.parse(readFileSync(vercelConfigPath, 'utf-8'));
    expect(config.rewrites).toBeDefined();
    expect(Array.isArray(config.rewrites)).toBe(true);

    // Verify SPA rewrite destination
    const spaRewrite = config.rewrites.find((r: any) => r.destination === '/index.html');
    expect(spaRewrite).toBeDefined();
    expect(spaRewrite.source).toBe('/(.*)');

    // Verify API routes are explicitly preserved and not rewritten to index.html
    const apiRewrite = config.rewrites.find((r: any) => r.source === '/api/(.*)');
    expect(apiRewrite).toBeDefined();
    expect(apiRewrite.destination).toBe('/api/$1');

    // Verify Production Security Headers in apps/web/vercel.json
    expect(config.headers).toBeDefined();
    const globalHeader = config.headers.find((h: any) => h.source === '/(.*)');
    expect(globalHeader).toBeDefined();
    const csp = globalHeader.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp.value).toContain("default-src 'self'");
    expect(csp.value).toContain("script-src 'self'");
    expect(csp.value).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp.value).toContain("frame-ancestors 'none'");
    expect(csp.value).toContain("object-src 'none'");

    const hsts = globalHeader.headers.find((h: any) => h.key === 'Strict-Transport-Security');
    expect(hsts?.value).toContain('max-age=31536000');

    const xfo = globalHeader.headers.find((h: any) => h.key === 'X-Frame-Options');
    expect(xfo?.value).toBe('DENY');
  });

  it('verifies root vercel.json preserves API and Web service monorepo routing and security headers', () => {
    const rootVercelPath = resolve(__dirname, '../../../vercel.json');
    expect(existsSync(rootVercelPath)).toBe(true);

    const rootConfig = JSON.parse(readFileSync(rootVercelPath, 'utf-8'));
    expect(rootConfig.services?.api?.root).toBe('apps/api');
    expect(rootConfig.services?.web?.root).toBe('apps/web');

    const apiRewrite = rootConfig.rewrites?.find((r: any) => r.source === '/api/(.*)');
    expect(apiRewrite?.destination?.service).toBe('api');

    const rootHeader = rootConfig.headers?.find((h: any) => h.source === '/(.*)');
    expect(rootHeader).toBeDefined();
    const rootCsp = rootHeader.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(rootCsp).toBeDefined();
    expect(rootCsp.value).toContain("frame-ancestors 'none'");
  });

  it('renders intended NotFound component for unknown routes', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/non-existent-page-url']}>
        <NotFound />
      </MemoryRouter>
    );

    expect(html).toContain('Error 404');
    expect(html).toContain('Page Not Found');
    expect(html).toContain("The page you&#x27;re looking for doesn&#x27;t exist or may have been moved.");
    expect(html).toContain('Go to Dashboard');
    expect(html).toContain('Go Back');
    expect(html).toContain('Back to Records');
    expect(html).toContain('RTR Mobiles');
  });

  it('renders owner return path on NotFound and does not include employee actions', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/unknown-employee-path']}>
        <NotFound isAuthenticated={true} />
      </MemoryRouter>
    );

    expect(html).toContain('Error 404');
    expect(html).toContain('Go to Dashboard');
    expect(html).toContain('Go Back');
    expect(html).toContain('Workspace Active');
    expect(html).not.toContain('Back to Daily Report');
    expect(html).not.toContain('Daily Report');
  });

  it('renders clean unauthenticated state on NotFound without workspace active badge', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/random-unauthenticated-path']}>
        <NotFound isAuthenticated={false} />
      </MemoryRouter>
    );

    expect(html).toContain('Error 404');
    expect(html).toContain('Page Not Found');
    expect(html).toContain('Go to Dashboard');
    expect(html).toContain('Go Back');
    expect(html).not.toContain('Workspace Active');
  });
});
