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

    // Verify Records, Statements, and Settings are the single primary reporting and workspace links
    expect(html).toContain('Records');
    expect(html).toContain('Statements');
    expect(html).toContain('Settings');
    expect(html).toContain('Logout');

    // Verify Analytics tab is completely consolidated and removed from sidebar
    expect(html).not.toContain('Analytics');
    expect(html).not.toContain('/analytics');

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

  it('completely removes sidebar, hamburger button, and mobile drawer when userRole is employee', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="employee"
          userName="Shop Staff"
          assignedShopName="Supreme Mobiles"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    // Sidebar navigation and hamburger controls must be removed for employees
    expect(html).not.toContain('aria-label="Main Desktop Navigation"');
    expect(html).not.toContain('aria-label="Open navigation menu"');
    expect(html).not.toContain('mobile-navigation-drawer');
    expect(html).not.toContain('w-[205px]');

    // Employee branding, live indicator, and profile badge remain
    expect(html).toContain('RTR');
    expect(html).toContain('Wholesale Management');
    expect(html).toContain('SHOP EMPLOYEE • Supreme Mobiles');
    expect(html).toContain('Shop Staff');
  });

  it('strictly excludes Settings link from employee profile menu', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Navbar
          userRole="employee"
          userName="Shop Staff"
          assignedShopName="Branch 1"
          isOnline={true}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>
    );

    // Settings must NOT appear for employee anywhere in Navbar
    expect(html).not.toContain('Settings');
    expect(html).not.toContain('/settings');
  });
});
