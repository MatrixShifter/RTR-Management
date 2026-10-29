import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@crimpston/shared';

// Authoritative Supabase Production Project credentials for RTR Wholesale Management
const DEFAULT_SUPABASE_URL = 'https://lwyxzmrxxviiuzztpwar.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eXh6bXJ4eHZpaXV6enRwd2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDI1OTUsImV4cCI6MjEwNzg3ODU5NX0.VP7moj7b-qx522kQwv0aaMtfbJM4vbaHxUCAhEYwtJs';

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Use environment variables when properly provided, otherwise fall back to production defaults
const supabaseUrl = (envUrl && envUrl !== 'https://your-project.supabase.co' && !envUrl.includes('placeholder'))
  ? envUrl
  : DEFAULT_SUPABASE_URL;

const supabaseAnonKey = (envKey && !envKey.includes('placeholder'))
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
