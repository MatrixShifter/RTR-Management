import fs from 'fs';

let content = fs.readFileSync('packages/shared/src/index.ts', 'utf8');

const startMarker = "// Confirmed Demo Entity Identifiers (Production Handover Exclusion)";
const endMarker = "// Record & Payment Mutation Validation Schemas";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const replacement = `// Confirmed Demo and Development Test Entity Identifiers (Production Handover Exclusion)
export const CONFIRMED_DEMO_SHOP_ID = '4ab21b42-209a-4e16-ae77-8c869ab973ed';
export const CONFIRMED_DEMO_PRODUCT_ID = '0cea2553-1467-4443-b329-4caf997b56d2';

export const CONFIRMED_DEMO_SHOP_IDS = [
  '4ab21b42-209a-4e16-ae77-8c869ab973ed', // DEMO - Mobile Shop A
  '05c290af-4977-42fa-bda2-8d8da30f27bf'  // shopa (development test shop)
];

export const CONFIRMED_DEMO_PRODUCT_IDS = [
  '0cea2553-1467-4443-b329-4caf997b56d2', // DEMO - Mobile Case
  'bf97d62e-dcf3-4022-8290-e45986ea1623', // producta (development test product)
  '312cdb3b-98b8-4f30-9860-bd9ef55f5b77'  // rqwrert (development test product)
];

export function isDemoShop(shop?: { id?: string | null; code?: string | null; name?: string | null } | null): boolean {
  if (!shop) return false;
  if (shop.id && CONFIRMED_DEMO_SHOP_IDS.includes(shop.id)) return true;
  if (shop.id === CONFIRMED_DEMO_SHOP_ID) return true;
  if (typeof shop.code === 'string' && shop.code.trim().toUpperCase().startsWith('DEMO')) return true;
  if (typeof shop.name === 'string') {
    const trimmed = shop.name.trim();
    if (/^(\\[DEMO\\]|DEMO\\s*-)/i.test(trimmed)) return true;
    if (trimmed.toLowerCase() === 'shopa') return true;
  }
  return false;
}

export function isDemoProduct(prod?: { id?: string | null; sku?: string | null; name?: string | null } | null): boolean {
  if (!prod) return false;
  if (prod.id && CONFIRMED_DEMO_PRODUCT_IDS.includes(prod.id)) return true;
  if (prod.id === CONFIRMED_DEMO_PRODUCT_ID) return true;
  if (typeof prod.sku === 'string' && prod.sku.trim().toUpperCase().startsWith('DEMO')) return true;
  if (typeof prod.name === 'string') {
    const trimmed = prod.name.trim();
    if (/^(\\[DEMO\\]|DEMO\\s*-)/i.test(trimmed)) return true;
    if (trimmed.toLowerCase() === 'producta' || trimmed.toLowerCase() === 'rqwrert') return true;
  }
  return false;
}

`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync('packages/shared/src/index.ts', content, 'utf8');
console.log('✓ Successfully updated packages/shared/src/index.ts');
