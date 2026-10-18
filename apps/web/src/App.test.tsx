import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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
