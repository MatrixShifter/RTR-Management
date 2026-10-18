import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve('supabase/migrations/0001_initial_schema.sql');
const seedPath = path.resolve('supabase/seed.sql');

function validateSqlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`Checking ${filePath} (${content.length} bytes)...`);

  // Basic sanity checks
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    throw new Error(`Mismatched parentheses: ${openParens} '(' vs ${closeParens} ')'`);
  }

  // Ensure no exposed secrets or keys
  const forbiddenPatterns = [
    /eyJhbGciOi/i, // JWT token signature
    /service_role_key/i,
    /anon_key/i,
    /BEGIN RSA PRIVATE KEY/i,
    /password123/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      throw new Error(`Forbidden secret pattern detected: ${pattern}`);
    }
  }

  // Verify key tables are present in migration
  if (filePath.includes('0001_initial_schema.sql')) {
    const requiredTables = [
      'businesses',
      'profiles',
      'business_memberships',
      'shops',
      'shop_memberships',
      'products',
      'deliveries',
      'delivery_items',
      'daily_reports',
      'daily_report_items',
      'stock_movements',
      'stock_counts',
      'stock_adjustments',
      'audit_logs',
      'idempotency_records'
    ];

    for (const table of requiredTables) {
      if (!content.includes(`CREATE TABLE IF NOT EXISTS public.${table}`)) {
        throw new Error(`Missing table definition for public.${table}`);
      }
      if (!content.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)) {
        throw new Error(`Missing RLS enablement for public.${table}`);
      }
    }

    console.log(`All ${requiredTables.length} tables verified with RLS!`);
  }

  console.log(`✓ ${path.basename(filePath)} passed all structural and security checks.`);
}

try {
  validateSqlFile(migrationPath);
  validateSqlFile(seedPath);
  console.log('SUCCESS: All SQL migrations and seeds are validated!');
} catch (err) {
  console.error('Validation failure:', err.message);
  process.exit(1);
}
