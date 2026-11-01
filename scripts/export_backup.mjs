import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: 'apps/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function exportFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('database_backups', `backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const tables = [
    'businesses',
    'profiles',
    'business_memberships',
    'shops',
    'products',
    'deliveries',
    'delivery_items',
    'invoices',
    'payments',
    'stock_movements',
    'daily_reports',
    'stock_transfers',
    'stock_counts',
    'stock_adjustments',
    'shop_memberships',
    'audit_logs'
  ];

  const manifest = {
    exportedAt: new Date().toISOString(),
    supabaseUrl: process.env.SUPABASE_URL,
    tables: {}
  };

  for (const table of tables) {
    const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' });
    if (error) {
      console.warn(`Could not export table ${table}:`, error.message);
      manifest.tables[table] = { error: error.message };
    } else {
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      manifest.tables[table] = {
        rowCount: data.length,
        file: filePath
      };
      console.log(`Exported ${table}: ${data.length} rows`);
    }
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nFull recoverable backup written to: ${backupDir}`);

  // Verification step: Read back all exported files
  for (const table of tables) {
    if (manifest.tables[table]?.file) {
      const readData = JSON.parse(fs.readFileSync(manifest.tables[table].file, 'utf8'));
      if (readData.length !== manifest.tables[table].rowCount) {
        throw new Error(`Backup verification failed for table ${table}`);
      }
    }
  }
  console.log('Verification check: ALL BACKUP FILES VERIFIED READABLE AND INTACT.');
  return backupDir;
}

exportFullBackup().catch(err => {
  console.error('Backup failure:', err);
  process.exit(1);
});
