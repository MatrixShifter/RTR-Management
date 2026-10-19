import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@crimpston/shared';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient<any> | null = isSupabaseConfigured
  ? (createClient<Database>(supabaseUrl, supabaseAnonKey) as unknown as SupabaseClient<any>)
  : null;
