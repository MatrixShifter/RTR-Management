import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar.js';

describe('Navbar Component — Responsive Sidebar & Top Header Architecture', () => {
  it('renders Records, Settings, and Logout in the simplified sidebar with whitespace-nowrap', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    // Verify Records is the central workspace link
    expect(html).toContain('Records');
    expect(html).toContain('Settings');
    expect(html).toContain('Logout');

    // Verify obsolete separate tabs are removed from user interface
    expect(html).not.toContain('Stock Ledger');
    expect(html).not.toContain('Product Catalog');
    expect(html).not.toContain('Daily Report');

    // Verify whitespace-nowrap is present on navigation items
    expect(html).toContain('whitespace-nowrap');
  });

  it('renders desktop sidebar navigation in a dedicated aside container', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    // Sidebar has dedicated aria-label and fixed positioning class
    expect(html).toContain('aria-label="Main Desktop Navigation"');
    expect(html).toContain('w-64 bg-crimpston-navy');
  });

  it('renders compact RTR brand section without heavy horizontal footprint', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(html).toContain('RTR');
    expect(html).toContain('Wholesale Management');
    expect(html).toContain('w-8 h-8 rounded-lg bg-crimpston-electric');
  });

  it('correctly distinguishes active route with refined styling in sidebar', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    // Active route gets blue text and electric-blue border highlight
    expect(html).toContain('text-blue-400');
    expect(html).toContain('border-crimpston-electric/40');
  });

  it('displays Live connectivity indicator in top header with accessible title', () => {
    const htmlOnline = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(htmlOnline).toContain('System connected and live');
    expect(htmlOnline).toContain('Live');

    const htmlOffline = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={false}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(htmlOffline).toContain('Working in offline mode');
    expect(htmlOffline).toContain('Offline');
  });

  it('renders strictly owner badge and no employee links', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(html).toContain('OWNER');
    expect(html).not.toContain('Daily Report');
    expect(html).not.toContain('Stock Overview');
    expect(html).not.toContain('EMPLOYEE');
  });

  it('includes accessible mobile toggle button with aria attributes', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(html).toContain('aria-label="Open navigation menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="mobile-navigation-drawer"');
  });
});
