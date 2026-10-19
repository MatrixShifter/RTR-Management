import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar.js';

describe('Navbar Component — Responsive Sidebar & Top Header Architecture', () => {
  it('renders all 6 owner navigation links vertically in the sidebar with whitespace-nowrap', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/analytics']}>
        <Navbar
          userRole="owner"
          userName="Business Owner"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    // Verify all 6 links
    expect(html).toContain('Overview');
    expect(html).toContain('Deliveries');
    expect(html).toContain('Stock Ledger');
    expect(html).toContain('Payments');
    expect(html).toContain('History &amp; Analytics');
    expect(html).toContain('Catalog &amp; Shops');

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
      <MemoryRouter initialEntries={['/management']}>
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

  it('renders employee-specific links when userRole is employee', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/employee']}>
        <Navbar
          userRole="employee"
          userName="Field Staff"
          assignedShopName="City Central Mobiles"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(html).toContain('Daily Report');
    expect(html).toContain('Stock Overview');
    expect(html).not.toContain('Catalog &amp; Shops');
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
