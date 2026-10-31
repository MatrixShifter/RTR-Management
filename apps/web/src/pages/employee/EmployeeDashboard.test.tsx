import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EmployeeDashboard } from './EmployeeDashboard.js';
import { setDemoMode } from '../../services/demoMode.js';

describe('EmployeeDashboard Read-Only Component Suite', () => {
  beforeEach(() => {
    setDemoMode(true);
  });

  const mockEmployeeUser = {
    id: 'emp-12345',
    email: 'ramesh@rtrmobiles.com',
    name: 'Ramesh Kumar',
    role: 'employee',
    assignedShopId: 'shop-1',
    assignedShopName: 'Shop A',
    assignedShopCode: 'RTR-SHOP-01'
  };

  it('renders employee dashboard with assigned shop identity and read-only badge', () => {
    const html = renderToString(
      <EmployeeDashboard currentUser={mockEmployeeUser} />
    );

    expect(html).toContain('My Shop Records');
    expect(html).toContain('Shop Employee (Read-Only)');
    expect(html).toContain('Shop A');
    expect(html).toContain('RTR-SHOP-01');
    expect(html).toContain('Ramesh Kumar');
  });

  it('strictly excludes owner actions: no Add Record button or delivery reversal triggers', () => {
    const html = renderToString(
      <EmployeeDashboard currentUser={mockEmployeeUser} />
    );

    // Verify absence of owner-only mutation triggers
    expect(html).not.toContain('Add Record');
    expect(html).not.toContain('Add Product');
    expect(html).not.toContain('Add Shop');
    expect(html).not.toContain('Delete Shop');
    expect(html).not.toContain('Safe Archive');
  });

  it('renders warning when employee account is unassigned to any shop', () => {
    const unassignedUser = {
      id: 'emp-unassigned',
      email: 'no.shop@rtrmobiles.com',
      name: 'Unassigned User',
      role: 'employee',
      assignedShopId: undefined,
      assignedShopName: undefined
    };

    const html = renderToString(
      <EmployeeDashboard currentUser={unassignedUser} />
    );

    expect(html).toContain('No Assigned Shop Found');
    expect(html).toContain('have not been assigned to a retail store');
  });
});
