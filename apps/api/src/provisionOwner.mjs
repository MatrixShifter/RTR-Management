/**
 * RTR Wholesale Management — Production Owner Provisioning Script
 * 
 * Usage:
 *   node src/provisionOwner.mjs [password]
 * 
 * Environment Variables (read from .env):
 *   SUPABASE_URL               - Supabase Project URL
 *   SUPABASE_SERVICE_ROLE_KEY  - Supabase Service Role Key (Admin)
 *   SUPABASE_ANON_KEY          - Supabase Anon Key (for auth verification)
 *   OWNER_EMAIL                - Initial Owner Email (default: owner@rtrmobiles.com)
 *   OWNER_USERNAME             - Initial Owner Username (default: owner)
 *   OWNER_PASSWORD             - Initial Owner Password (or passed as argument)
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'vinov042007@gmail.com').trim().toLowerCase();
const OWNER_USERNAME = (process.env.OWNER_USERNAME || 'owner').trim().toLowerCase();
const OWNER_FULL_NAME = process.env.OWNER_FULL_NAME || 'Business Owner';

// Password priority: CLI argument -> ENV variable -> Generated random password
const cliPassword = process.argv[2];
const OWNER_PASSWORD = cliPassword || process.env.OWNER_PASSWORD || `RTR-${crypto.randomBytes(6).toString('hex')}!2026`;

export async function provisionOwnerAccount() {
  console.log(`\n======================================================`);
  console.log(` RTR Wholesale Management — Real Owner Provisioning`);
  console.log(`======================================================\n`);
  console.log(`Target Email:    ${OWNER_EMAIL}`);
  console.log(`Target Username: ${OWNER_USERNAME}`);

  // 1. Search for existing user in Supabase Auth
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase Auth users: ${listError.message}`);
  }

  let ownerUser = users.find(u => 
    u.email?.toLowerCase() === OWNER_EMAIL ||
    u.user_metadata?.username?.toLowerCase() === OWNER_USERNAME
  );

  if (!ownerUser) {
    console.log(`Creating new owner account in Supabase Auth...`);
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: OWNER_USERNAME,
        full_name: OWNER_FULL_NAME,
        role: 'owner'
      }
    });

    if (createError) {
      throw new Error(`Failed to create owner user: ${createError.message}`);
    }
    ownerUser = data.user;
    console.log(`✓ Created owner user: ${ownerUser.id}`);
  } else {
    console.log(`Existing owner user found: ${ownerUser.id}. Updating credentials...`);
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(ownerUser.id, {
      password: OWNER_PASSWORD,
      email: OWNER_EMAIL,
      email_confirm: true,
      user_metadata: {
        ...ownerUser.user_metadata,
        username: OWNER_USERNAME,
        full_name: OWNER_FULL_NAME,
        role: 'owner'
      }
    });

    if (updateError) {
      throw new Error(`Failed to update owner credentials: ${updateError.message}`);
    }
    ownerUser = data.user;
    console.log(`✓ Updated owner credentials successfully.`);
  }

  // 2. Ensure profile exists in public.profiles table
  console.log(`Syncing profile in public.profiles...`);
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: ownerUser.id,
      email: OWNER_EMAIL,
      full_name: OWNER_FULL_NAME,
      username: OWNER_USERNAME,
      role: 'owner',
      is_active: true
    }, { onConflict: 'id' });

  if (profileError) {
    console.warn(`Warning updating public.profiles: ${profileError.message}`);
  } else {
    console.log(`✓ Profile synced in public.profiles.`);
  }

  // 3. Ensure business membership in public.business_memberships
  const { data: businesses } = await supabaseAdmin
    .from('businesses')
    .select('id')
    .eq('is_active', true)
    .limit(1);

  if (businesses && businesses.length > 0) {
    const businessId = businesses[0].id;
    const { error: memberError } = await supabaseAdmin
      .from('business_memberships')
      .upsert({
        business_id: businessId,
        user_id: ownerUser.id,
        role: 'owner',
        is_active: true
      }, { onConflict: 'business_id,user_id' });

    if (memberError) {
      console.warn(`Warning updating business membership: ${memberError.message}`);
    } else {
      console.log(`✓ Owner associated with business workspace (${businessId}).`);
    }
  }

  // 4. Verify login via Supabase Anon Client if anon key is available
  if (anonKey) {
    console.log(`Verifying authentication with Supabase Anon Client...`);
    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });

    if (authError || !authData.session) {
      throw new Error(`Owner authentication verification failed: ${authError?.message}`);
    }
    console.log(`✓ Verification successful: Real owner token issued.`);
  }

  console.log(`\n======================================================`);
  console.log(` ✅ Real Owner Account Successfully Provisioned`);
  console.log(`======================================================`);
  console.log(`Username: ${OWNER_USERNAME}`);
  console.log(`Email:    ${OWNER_EMAIL}`);
  console.log(`Password: ${OWNER_PASSWORD}`);
  console.log(`\nThe owner can now sign in immediately at the Login page.`);
  console.log(`After initial login, the owner can change their password at any`);
  console.log(`time using the 'Forgot Password' link or Settings page.\n`);

  return ownerUser;
}

provisionOwnerAccount().catch(err => {
  console.error(`\n❌ Error provisioning owner account:`, err.message);
  process.exit(1);
});
