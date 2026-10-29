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

const EnvironmentSchema = z.object({
  PORT: z.union([z.string(), z.number()]).default('4000').transform(val => typeof val === 'number' ? val : parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().default('https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: z.string().min(1).default('placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('placeholder-service-role-key')
});

const parsed = EnvironmentSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment configuration validation failed');
}

export const config = parsed.data;
