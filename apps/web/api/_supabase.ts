import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://lwyxzmrxxviiuzztpwar.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eXh6bXJ4eHZpaXV6enRwd2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDI1OTUsImV4cCI6MjEwNzg3ODU5NX0.VP7moj7b-qx522kQwv0aaMtfbJM4vbaHxUCAhEYwtJs';

export const supabaseUrl = 
  process.env.SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  DEFAULT_SUPABASE_URL;

export const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  DEFAULT_SUPABASE_ANON_KEY;

export const supabaseServiceRoleKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  '';

export const configuredOwnerEmail = (
  process.env.OWNER_EMAIL || 
  process.env.VITE_OWNER_EMAIL || 
  'vinov042007@gmail.com'
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
  if (VERIFIED_USERNAME_MAP[clean]) return VERIFIED_USERNAME_MAP[clean];
  if (clean.includes('@')) {
    if (clean === configuredOwnerEmail || clean === 'demo-owner@rtrmobiles.com') {
      return clean;
    }
    if (clean.includes('vino') || clean.includes('rtrmobiles')) {
      return configuredOwnerEmail;
    }
    return clean;
  }
  return null;
}
