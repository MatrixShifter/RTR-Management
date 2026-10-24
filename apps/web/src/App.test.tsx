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
  });

  it('verifies root vercel.json preserves API and Web service monorepo routing', () => {
    const rootVercelPath = resolve(__dirname, '../../../vercel.json');
    expect(existsSync(rootVercelPath)).toBe(true);

    const rootConfig = JSON.parse(readFileSync(rootVercelPath, 'utf-8'));
    expect(rootConfig.services?.api?.root).toBe('apps/api');
    expect(rootConfig.services?.web?.root).toBe('apps/web');

    const apiRewrite = rootConfig.rewrites?.find((r: any) => r.source === '/api/(.*)');
    expect(apiRewrite?.destination?.service).toBe('api');
  });

  it('renders intended NotFound component for unknown routes', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/non-existent-page-url']}>
        <NotFound />
      </MemoryRouter>
    );

    expect(html).toContain('Error 404');
    expect(html).toContain('Page Not Found');
    expect(html).toContain('Back to Records');
  });

  it('renders owner return path on NotFound and does not include employee actions', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/unknown-employee-path']}>
        <NotFound />
      </MemoryRouter>
    );

    expect(html).toContain('Error 404');
    expect(html).toContain('Back to Records');
    expect(html).not.toContain('Back to Daily Report');
    expect(html).not.toContain('Daily Report');
  });
});
