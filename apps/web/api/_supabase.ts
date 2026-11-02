import { createClient } from '@supabase/supabase-js';

// Authoritative Supabase Production Project credentials for RTR Wholesale Management
// Project Reference: xjlnoxbkcyymtdtallzu (Authoritative client production instance)
const DEFAULT_SUPABASE_URL = 'https://xjlnoxbkcyymtdtallzu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbG5veGJrY3l5bXRkdGFsbHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Mjg1MzYsImV4cCI6MjEwOTIwNDUzNn0.EYYuap8TBqd-0Sv1CMD4SjP33dFIlvpTY5Zsx--bHCg';

const rawEnvUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const rawEnvKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Reject deprecated development project to prevent split-brain sessions
const isLegacyAgencyProject = rawEnvUrl.includes('lwyxzmrxxviiuzztpwar');
if (isLegacyAgencyProject) {
  console.error('[Supabase Config Error] Deprecated development project URL (lwyxzmrxxviiuzztpwar) detected in serverless environment. Using authoritative client production project (xjlnoxbkcyymtdtallzu).');
}

export const supabaseUrl = (!isLegacyAgencyProject && rawEnvUrl && !rawEnvUrl.includes('placeholder'))
  ? rawEnvUrl
  : DEFAULT_SUPABASE_URL;

export const supabaseAnonKey = (!isLegacyAgencyProject && rawEnvKey && !rawEnvKey.includes('placeholder'))
  ? rawEnvKey
  : DEFAULT_SUPABASE_ANON_KEY;

export const supabaseServiceRoleKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  '';

export const configuredOwnerEmail = (
  process.env.OWNER_EMAIL || 
  process.env.VITE_OWNER_EMAIL || 
  'rtrmobile92@gmail.com'
).trim().toLowerCase();

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : supabaseAnon;

export const VERIFIED_USERNAME_MAP: Record<string, string> = {
  'owner': configuredOwnerEmail,
  'vino': configuredOwnerEmail,
  'rtrowner': configuredOwnerEmail,
  'rtrmobiles': configuredOwnerEmail,
  'demo-owner': 'demo-owner@rtrmobiles.com'
};

export function resolveIdentifierToEmail(identifier: string): string | null {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return null;
  // If it's a known owner username alias (e.g. 'owner', 'vino', 'rtrowner', 'demo-owner')
  if (VERIFIED_USERNAME_MAP[clean]) {
    return VERIFIED_USERNAME_MAP[clean];
  }
  // If it's an email address, preserve it exactly as entered (unless owner alias)
  if (clean.includes('@')) {
    if (clean === 'owner@rtrmobiles.com') {
      return configuredOwnerEmail;
    }
    return clean;
  }
  return null;
}
