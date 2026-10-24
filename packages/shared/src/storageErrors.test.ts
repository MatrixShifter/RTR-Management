import { describe, it, expect } from 'vitest';
import {
  isDatabaseCapacityError,
  DatabaseCapacityError,
  DATABASE_STORAGE_FULL_TITLE,
  DATABASE_STORAGE_FULL_MESSAGE,
  evaluateStorageHealth,
} from './storageErrors.js';

describe('Storage Capacity Error Handling', () => {
  it('has exact required title and user message', () => {
    expect(DATABASE_STORAGE_FULL_TITLE).toBe('Database Storage Full');
    expect(DATABASE_STORAGE_FULL_MESSAGE).toBe(
      'Your database has reached its storage limit. This record could not be saved. Please contact your administrator to free up storage or upgrade the database plan. Try again after the issue is resolved.'
    );
  });

  describe('isDatabaseCapacityError', () => {
    it('detects Postgres 53100 disk full error code', () => {
      const err = { code: '53100', message: 'could not write to file: No space left on device' };
      expect(isDatabaseCapacityError(err)).toBe(true);
    });

    it('detects Postgres 53000 insufficient resources code', () => {
      const err = { code: '53000', message: 'insufficient resources' };
      expect(isDatabaseCapacityError(err)).toBe(true);
    });

    it('detects HTTP 507 Insufficient Storage', () => {
      const err = { status: 507, message: 'Insufficient Storage' };
      expect(isDatabaseCapacityError(err)).toBe(true);
    });

    it('detects storage limit messages in errors', () => {
      expect(isDatabaseCapacityError(new Error('database storage limit exceeded'))).toBe(true);
      expect(isDatabaseCapacityError({ message: 'Project has reached its storage limit' })).toBe(true);
      expect(isDatabaseCapacityError({ message: 'disk full while writing WAL' })).toBe(true);
      expect(isDatabaseCapacityError({ details: 'No space left on device' })).toBe(true);
      expect(isDatabaseCapacityError('quota exceeded for database storage')).toBe(true);
    });

    it('detects instances of DatabaseCapacityError', () => {
      const err = new DatabaseCapacityError();
      expect(isDatabaseCapacityError(err)).toBe(true);
      expect(err.message).toBe(DATABASE_STORAGE_FULL_MESSAGE);
      expect(err.name).toBe('DatabaseCapacityError');
    });

    it('does NOT flag rate limits as capacity errors', () => {
      expect(isDatabaseCapacityError({ status: 429, message: 'Too Many Requests' })).toBe(false);
      expect(isDatabaseCapacityError({ code: '429', message: 'Rate limit exceeded' })).toBe(false);
      expect(isDatabaseCapacityError(new Error('Rate limit exceeded. Please slow down.'))).toBe(false);
    });

    it('does NOT flag authentication or permission errors', () => {
      expect(isDatabaseCapacityError({ code: '42501', message: 'permission denied for table deliveries' })).toBe(false);
      expect(isDatabaseCapacityError({ status: 401, message: 'Invalid JWT' })).toBe(false);
      expect(isDatabaseCapacityError({ status: 403, message: 'Forbidden' })).toBe(false);
    });

    it('does NOT flag data constraint violations', () => {
      expect(isDatabaseCapacityError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
      expect(isDatabaseCapacityError({ code: '23503', message: 'violates foreign key constraint' })).toBe(false);
      expect(isDatabaseCapacityError({ code: '23502', message: 'null value in column violates not-null constraint' })).toBe(false);
    });

    it('handles null, undefined, and non-error types gracefully', () => {
      expect(isDatabaseCapacityError(null)).toBe(false);
      expect(isDatabaseCapacityError(undefined)).toBe(false);
      expect(isDatabaseCapacityError(42)).toBe(false);
      expect(isDatabaseCapacityError({})).toBe(false);
    });
  });

  describe('evaluateStorageHealth', () => {
    it('returns verified healthy when usage is below 80%', () => {
      const res = evaluateStorageHealth(500 * 1024 * 1024, 1000 * 1024 * 1024);
      expect(res.verified).toBe(true);
      expect(res.status).toBe('healthy');
      expect(res.usagePercentage).toBe(50);
    });

    it('triggers warning at 80% capacity', () => {
      const res = evaluateStorageHealth(800 * 1024 * 1024, 1000 * 1024 * 1024);
      expect(res.verified).toBe(true);
      expect(res.status).toBe('warning');
      expect(res.usagePercentage).toBe(80);
      expect(res.message).toContain('Warning: Database storage usage is at 80%');
    });

    it('triggers critical warning at 95% capacity', () => {
      const res = evaluateStorageHealth(955 * 1024 * 1024, 1000 * 1024 * 1024);
      expect(res.verified).toBe(true);
      expect(res.status).toBe('critical');
      expect(res.usagePercentage).toBe(95.5);
      expect(res.message).toContain('Critical: Database storage has reached 95.5%');
    });

    it('handles invalid metrics without inventing values', () => {
      const res = evaluateStorageHealth(-10, 0);
      expect(res.verified).toBe(false);
      expect(res.status).toBe('unknown');
    });
  });
});
