# Database Backup & Disaster Recovery Procedures

## 1. Supabase Managed Backups
- **Continuous WAL Archiving**: Point-In-Time-Recovery (PITR) allows database restoration to any second within the retention window (typically 7–30 days depending on tier).
- **Daily Logical Backups**: Automated snapshots taken every 24 hours.

## 2. Disaster Recovery Protocol (Cold Standby / Logical Restore)
In the event of accidental data corruption or disaster recovery requirement:
1. Export latest clean snapshot or PITR clone via Supabase Dashboard.
2. In disaster fallback environment:
   ```bash
   pg_restore -h [TARGET_HOST] -U postgres -d postgres [BACKUP_FILE]
   ```
3. Re-apply schema validation scripts to ensure RLS policies and table grants remain intact:
   ```bash
   psql -f supabase/migrations/20261018000001_rls_policies.sql
   ```

## 3. Data Integrity & Resilience Audits
- Periodic verification of `stock_movements` against calculated stock totals (`expected_stock`).
- Discrepancy reports flag any variance between physical stock counts and confirmed recorded ledger entries.
