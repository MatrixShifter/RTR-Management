import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EmptyState } from './EmptyState.js';
import { Store, PackageOpen } from 'lucide-react';

describe('EmptyState Component — Safe Rendering & Resiliency', () => {
  it('renders safely without throwing when icon is omitted or undefined', () => {
    expect(() => {
      const html = renderToString(
        <EmptyState
          title="No records found"
          description="There are no supply records."
        />
      );
      expect(html).toContain('No records found');
      expect(html).toContain('There are no supply records.');
    }).not.toThrow();
  });

  it('renders safely when icon is passed as a LucideIcon component reference', () => {
    expect(() => {
      const html = renderToString(
        <EmptyState
          icon={Store}
          title="No retail partner shops available"
          description="Add shops in management."
        />
      );
      expect(html).toContain('No retail partner shops available');
    }).not.toThrow();
  });

  it('renders safely when icon is passed as an instantiated React JSX element', () => {
    expect(() => {
      const html = renderToString(
        <EmptyState
          icon={<PackageOpen className="w-8 h-8" />}
          title="Zero Deliveries"
          description="No deliveries yet."
        />
      );
      expect(html).toContain('Zero Deliveries');
    }).not.toThrow();
  });

  it('renders action button correctly when actionLabel and onAction are supplied', () => {
    const html = renderToString(
      <EmptyState
        title="No items"
        description="Please add items."
        actionLabel="Add Item"
        onAction={() => {}}
      />
    );
    expect(html).toContain('Add Item');
  });

  it('renders action button correctly when legacy actionText and onAction are supplied', () => {
    const html = renderToString(
      <EmptyState
        title="No items"
        description="Please add items."
        actionText="Manage Shops"
        onAction={() => {}}
      />
    );
    expect(html).toContain('Manage Shops');
  });

  it('renders custom action node when provided', () => {
    const html = renderToString(
      <EmptyState
        title="Custom Action"
        description="Testing custom action element."
        action={<button id="custom-btn">Click Me</button>}
      />
    );
    expect(html).toContain('id="custom-btn"');
    expect(html).toContain('Click Me');
  });
});
