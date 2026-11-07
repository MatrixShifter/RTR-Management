import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(currentDir, '..');
const projectRootDir = path.resolve(currentDir, '../../..');

// Load environment configurations: cwd, apps/api/.env, and project root .env
dotenv.config();
dotenv.config({ path: path.resolve(apiRootDir, '.env') });
dotenv.config({ path: path.resolve(projectRootDir, '.env') });

// Authoritative Supabase Production Project credentials for RTR Wholesale Management
// Project Reference: xjlnoxbkcyymtdtallzu (Authoritative client production instance)
const AUTHORITATIVE_PRODUCTION_SUPABASE_URL = 'https://xjlnoxbkcyymtdtallzu.supabase.co';

const EnvironmentSchema = z.object({
  PORT: z.union([z.string(), z.number()]).default('4000').transform(val => typeof val === 'number' ? val : parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().default(AUTHORITATIVE_PRODUCTION_SUPABASE_URL),
  SUPABASE_ANON_KEY: z.string().min(1).default('placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('placeholder-service-role-key'),
  REDIS_URL: z.string().url().optional(),
  RATE_LIMIT_STANDARD_MAX: z.union([z.string(), z.number()]).default(300).transform(val => typeof val === 'number' ? val : parseInt(val, 10)),
  RATE_LIMIT_AUTH_MAX: z.union([z.string(), z.number()]).default(30).transform(val => typeof val === 'number' ? val : parseInt(val, 10)),
  RATE_LIMIT_MUTATION_MAX: z.union([z.string(), z.number()]).default(60).transform(val => typeof val === 'number' ? val : parseInt(val, 10)),
  RATE_LIMIT_PAYMENT_MAX: z.union([z.string(), z.number()]).default(30).transform(val => typeof val === 'number' ? val : parseInt(val, 10)),
  REQUEST_TIMEOUT_MS: z.union([z.string(), z.number()]).default(25000).transform(val => typeof val === 'number' ? val : parseInt(val, 10))
}).superRefine((data, ctx) => {
  // Reject deprecated development project to prevent split-brain database states
  if (data.SUPABASE_URL.includes('lwyxzmrxxviiuzztpwar')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Legacy development Supabase project (lwyxzmrxxviiuzztpwar) is strictly disallowed. Use authoritative production project (https://xjlnoxbkcyymtdtallzu.supabase.co).',
      path: ['SUPABASE_URL']
    });
  }

  // Strict validation for production environments (Render / cloud servers)
  if (data.NODE_ENV === 'production') {
    if (data.SUPABASE_URL.includes('placeholder') || data.SUPABASE_URL.includes('your-project')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid production SUPABASE_URL is required in production environment.',
        path: ['SUPABASE_URL']
      });
    }
    if (data.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid SUPABASE_SERVICE_ROLE_KEY is required in production environment.',
        path: ['SUPABASE_SERVICE_ROLE_KEY']
      });
    }
  }
});

const parsed = EnvironmentSchema.safeParse(process.env);

if (!parsed.success) {
  const invalidFields = Object.keys(parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line no-console
  console.error(`Invalid or missing environment configuration for fields: ${invalidFields.join(', ')}`);
  throw new Error('Environment configuration validation failed');
}

export const config = parsed.data;
