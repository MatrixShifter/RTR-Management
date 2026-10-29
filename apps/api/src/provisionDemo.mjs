import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const DEMO_EMAIL = 'demo-owner@rtrmobiles.com';
const DEMO_USERNAME = 'demo-owner';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Configure-a-unique-demo-password';

export async function provisionDemoAccount() {
  console.log(`Checking for demo account ${DEMO_EMAIL} in Supabase Auth...`);
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  let demoUser = users.find(u => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());

  if (!demoUser) {
    console.log(`Creating demo user ${DEMO_EMAIL} via Supabase Admin API...`);
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: DEMO_USERNAME,
        full_name: 'Demo Owner (Sandbox)',
        role: 'demo'
      }
    });

    if (createError) {
      throw createError;
    }
    demoUser = data.user;
    console.log(`✓ Successfully provisioned demo user ${demoUser.id} (${demoUser.email})`);
  } else {
    console.log(`Demo user already exists: ${demoUser.id}. Updating password and metadata...`);
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(demoUser.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: DEMO_USERNAME,
        full_name: 'Demo Owner (Sandbox)',
        role: 'demo'
      }
    });
    if (updateError) {
      throw updateError;
    }
    demoUser = data.user;
    console.log(`✓ Updated demo user credentials successfully.`);
  }

  // Ensure profile in public.profiles exists
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', demoUser.id)
    .maybeSingle();

  if (!profile) {
    console.log(`Inserting profile for demo user in public.profiles...`);
    await supabaseAdmin.from('profiles').insert({
      id: demoUser.id,
      email: DEMO_EMAIL,
      full_name: 'Demo Owner (Sandbox)',
      username: DEMO_USERNAME
    });
  }

  // Verify demo user can authenticate via signInWithPassword using anon key
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });

  if (authError || !authData.session) {
    console.error('Authentication test failed:', authError);
    throw new Error('Demo authentication verification failed');
  }

  console.log('✓ Verification successful: demo user session established successfully.');
  return demoUser;
}

provisionDemoAccount().catch(err => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
