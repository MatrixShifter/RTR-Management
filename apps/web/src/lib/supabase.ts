import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@crimpston/shared';

// Authoritative Supabase Production Project credentials for RTR Wholesale Management
// Project Reference: xjlnoxbkcyymtdtallzu (Authoritative client production instance)
const DEFAULT_SUPABASE_URL = 'https://xjlnoxbkcyymtdtallzu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbG5veGJrY3l5bXRkdGFsbHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mjg1MzYsImV4cCI6MjEwOTIwNDUzNn0.EYYuap8TBqd-0Sv1CMD4SjP33dFIlvpTY5Zsx--bHCg';

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Reject deprecated development project to prevent split-brain sessions
const isLegacyAgencyProject = envUrl.includes('lwyxzmrxxviiuzztpwar');
if (isLegacyAgencyProject && typeof console !== 'undefined') {
  console.error('[Supabase Config Error] Deprecated development project URL (lwyxzmrxxviiuzztpwar) detected in environment. Using authoritative client production project (xjlnoxbkcyymtdtallzu).');
}

// Use environment variables when properly provided, otherwise fall back to production defaults
const supabaseUrl = (!isLegacyAgencyProject && envUrl && envUrl !== 'https://your-project.supabase.co' && !envUrl.includes('placeholder'))
  ? envUrl
  : DEFAULT_SUPABASE_URL;

const supabaseAnonKey = (!isLegacyAgencyProject && envKey && !envKey.includes('placeholder'))
  ? envKey
  : DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient<any> | null = isSupabaseConfigured
  ? (createClient<Database>(supabaseUrl, supabaseAnonKey) as unknown as SupabaseClient<any>)
  : null;
