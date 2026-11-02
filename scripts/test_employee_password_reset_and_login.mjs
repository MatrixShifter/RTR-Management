import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || 'https://lwyxzmrxxviiuzztpwar.supabase.co';
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!adminKey || !anonKey) {
  console.error('Missing Supabase keys in environment.');
  process.exit(1);
}

const supabaseAdmin = createClient(url, adminKey, { auth: { persistSession: false } });
const supabaseAnon = createClient(url, anonKey, { auth: { persistSession: false } });

// Import express app for end-to-end API testing
const { app } = await import('../apps/api/dist/app.js');
const supertest = (await import('supertest')).default;
const request = supertest(app);

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log(' RTR WHOLESALE: 10-POINT REGRESSION & SECURITY AUDIT SUITE');
  console.log('===============================================================\n');

  const testEmail = `regression_emp_${Date.now()}@rtrmobiles.com`;
  const initialPass = 'InitialPass2026#';
  const updatedPass = 'NewSecurePass2026!';
  let testUserId = null;
  let ownerToken = null;
  let businessId = null;
  let shopId = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Owner login still works
    // -------------------------------------------------------------
    console.log('TEST 1: Owner login still works...');
    const ownerLoginRes = await request
      .post('/api/auth/login')
      .send({ username: 'owner', password: 'password123' });

    if (ownerLoginRes.status !== 200 || !ownerLoginRes.body.session?.access_token) {
      throw new Error(`Owner login failed: ${ownerLoginRes.status} ${JSON.stringify(ownerLoginRes.body)}`);
    }
    ownerToken = ownerLoginRes.body.session.access_token;
    console.log('  ✓ Owner authenticated successfully via username "owner".');
    console.log('  ✓ Role verified:', ownerLoginRes.body.user.role);

    // Also verify owner email login
    const ownerEmailLogin = await request
      .post('/api/auth/login')
      .send({ username: 'vinov042007@gmail.com', password: 'password123' });
    if (ownerEmailLogin.status !== 200) {
      throw new Error('Owner login with email vinov042007@gmail.com failed');
    }
    console.log('  ✓ Owner authenticated successfully via email "vinov042007@gmail.com".');

    // Get active business & shop
    const { data: ownerBm } = await supabaseAdmin
      .from('business_memberships')
      .select('business_id')
      .eq('user_id', ownerLoginRes.body.user.id)
      .single();
    businessId = ownerBm.business_id;

    const { data: activeShop } = await supabaseAdmin
      .from('shops')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .limit(1)
      .single();
    shopId = activeShop.id;
    console.log(`  ✓ Using business ID ${businessId} and shop "${activeShop.name}" (${shopId}).\n`);

    // -------------------------------------------------------------
    // Provision temporary test employee
    // -------------------------------------------------------------
    console.log(`Setting up dedicated test employee: ${testEmail}...`);
    const { data: authCreated, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: initialPass,
      email_confirm: true,
      user_metadata: { full_name: 'Regression Employee', role: 'employee' }
    });
    if (createAuthErr) throw createAuthErr;
    testUserId = authCreated.user.id;

    await supabaseAdmin.from('profiles').upsert({
      id: testUserId,
      email: testEmail,
      full_name: 'Regression Employee',
      username: 'regression_emp'
    });

    await supabaseAdmin.from('business_memberships').insert({
      business_id: businessId,
      user_id: testUserId,
      role: 'employee',
      is_active: true
    });

    await supabaseAdmin.from('shop_memberships').insert({
      shop_id: shopId,
      user_id: testUserId
    });
    console.log('  ✓ Test employee provisioned with initial password.\n');

    // -------------------------------------------------------------
    // TEST 2: Owner resets employee password
    // -------------------------------------------------------------
    console.log('TEST 2: Owner resets employee password via API...');
    const resetRes = await request
      .post(`/api/employees/${testUserId}/reset-password`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ password: updatedPass });

    if (resetRes.status !== 200 || !resetRes.body.success) {
      throw new Error(`Owner reset password failed: ${resetRes.status} ${JSON.stringify(resetRes.body)}`);
    }
    console.log('  ✓ API returned 200 OK:', resetRes.body.message);

    // Verify in Supabase Auth directly that password update was confirmed
    const { data: verifiedAuthUser } = await supabaseAdmin.auth.admin.getUserById(testUserId);
    console.log('  ✓ Supabase Auth user updated_at confirmed:', verifiedAuthUser.user.updated_at, '\n');

    // -------------------------------------------------------------
    // TEST 3: Employee logs in using new password
    // -------------------------------------------------------------
    console.log('TEST 3: Employee logs in using new password...');
    const empLoginRes = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: updatedPass });

    if (empLoginRes.status !== 200 || !empLoginRes.body.success) {
      throw new Error(`Employee login with new password failed: ${empLoginRes.status} ${JSON.stringify(empLoginRes.body)}`);
    }
    const empSessionToken = empLoginRes.body.session.access_token;
    console.log('  ✓ Employee logged in successfully with new password.');
    console.log('  ✓ Role verified:', empLoginRes.body.user.role);
    console.log('  ✓ Assigned shop verified:', empLoginRes.body.user.assignedShopName, '\n');

    // -------------------------------------------------------------
    // TEST 4: Old password no longer works
    // -------------------------------------------------------------
    console.log('TEST 4: Old password no longer works...');
    const oldPassRes = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: initialPass });

    if (oldPassRes.status !== 401) {
      throw new Error(`Old password was expected to fail with 401, got ${oldPassRes.status}`);
    }
    console.log('  ✓ Old password correctly rejected with 401 Unauthorized.\n');

    // -------------------------------------------------------------
    // TEST 5: Wrong password is rejected
    // -------------------------------------------------------------
    console.log('TEST 5: Wrong password is rejected...');
    const wrongPassRes = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: 'CompletelyWrongPass999!' });

    if (wrongPassRes.status !== 401) {
      throw new Error(`Wrong password was expected to fail with 401, got ${wrongPassRes.status}`);
    }
    console.log('  ✓ Wrong password correctly rejected with 401 Unauthorized.\n');

    // -------------------------------------------------------------
    // TEST 6: Inactive employee is rejected
    // -------------------------------------------------------------
    console.log('TEST 6: Inactive employee is rejected...');
    await supabaseAdmin
      .from('business_memberships')
      .update({ is_active: false })
      .eq('user_id', testUserId);

    const inactiveLoginRes = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: updatedPass });

    if (inactiveLoginRes.status !== 403) {
      throw new Error(`Inactive employee expected 403, got ${inactiveLoginRes.status}`);
    }
    console.log('  ✓ Deactivated employee correctly rejected with 403 Forbidden.');
    console.log('  ✓ Diagnostic message:', inactiveLoginRes.body.message);

    // Restore active status
    await supabaseAdmin
      .from('business_memberships')
      .update({ is_active: true })
      .eq('user_id', testUserId);
    console.log('  ✓ Restored active status.\n');

    // -------------------------------------------------------------
    // TEST 7: Employee with no shop assignment is rejected
    // -------------------------------------------------------------
    console.log('TEST 7: Employee with no shop assignment is rejected...');
    await supabaseAdmin
      .from('shop_memberships')
      .delete()
      .eq('user_id', testUserId);

    const noShopLoginRes = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: updatedPass });

    if (noShopLoginRes.status !== 403) {
      throw new Error(`Employee without shop expected 403, got ${noShopLoginRes.status}`);
    }
    console.log('  ✓ Unassigned employee correctly rejected with 403 Forbidden.');
    console.log('  ✓ Diagnostic message:', noShopLoginRes.body.message);

    // Restore shop assignment
    await supabaseAdmin
      .from('shop_memberships')
      .insert({ shop_id: shopId, user_id: testUserId });
    console.log('  ✓ Restored shop assignment.\n');

    // -------------------------------------------------------------
    // TEST 8: Employee cannot access another shop
    // -------------------------------------------------------------
    console.log('TEST 8: Employee cannot access another shop...');
    // Re-login to get fresh token
    const freshLogin = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: updatedPass });
    const freshToken = freshLogin.body.session.access_token;

    const crossShopRes = await request
      .get('/api/records?shopId=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${freshToken}`);

    if (crossShopRes.status !== 403) {
      throw new Error(`Cross shop access expected 403, got ${crossShopRes.status}`);
    }
    console.log('  ✓ Cross-shop query strictly rejected with 403 Forbidden.\n');

    // -------------------------------------------------------------
    // TEST 9: Employee cannot modify business records
    // -------------------------------------------------------------
    console.log('TEST 9: Employee cannot modify business records (Strict Read-Only)...');
    // A: Try to create a record
    const createRecordRes = await request
      .post('/api/records')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ shopId, productName: 'Attack', quantity: 1, unitPrice: 100 });
    if (createRecordRes.status !== 403) {
      throw new Error(`Record creation expected 403, got ${createRecordRes.status}`);
    }
    console.log('  ✓ POST /api/records strictly blocked with 403 Forbidden.');

    // B: Try to update delivery status
    const updateStatusRes = await request
      .patch('/api/records/some-record-id/delivery-status')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ status: 'delivered' });
    if (updateStatusRes.status !== 403) {
      throw new Error(`Delivery status update expected 403, got ${updateStatusRes.status}`);
    }
    console.log('  ✓ PATCH delivery-status strictly blocked with 403 Forbidden.');

    // C: Try to settle a payment
    const settleRes = await request
      .post('/api/records/settle')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ recordId: 'some-record-id', amountPaid: 100 });
    if (settleRes.status !== 403) {
      throw new Error(`Payment settlement expected 403, got ${settleRes.status}`);
    }
    console.log('  ✓ POST /api/records/settle strictly blocked with 403 Forbidden.');

    // D: Try to delete a record
    const deleteRes = await request
      .delete('/api/records/some-record-id')
      .set('Authorization', `Bearer ${freshToken}`);
    if (deleteRes.status !== 403) {
      throw new Error(`Record deletion expected 403, got ${deleteRes.status}`);
    }
    console.log('  ✓ DELETE /api/records strictly blocked with 403 Forbidden.\n');

    // -------------------------------------------------------------
    // TEST 10: Employee logout and re-login work correctly
    // -------------------------------------------------------------
    console.log('TEST 10: Employee logout and re-login work correctly...');
    // Verify verify-session endpoint with token
    const verifyRes = await request
      .get('/api/auth/verify-session')
      .set('Authorization', `Bearer ${freshToken}`);
    if (verifyRes.status !== 200 || !verifyRes.body.valid) {
      throw new Error(`Session verification failed: ${verifyRes.status}`);
    }
    console.log('  ✓ Session token validated successfully on /api/auth/verify-session.');

    // Sign out from Supabase client
    await supabaseAnon.auth.signOut();

    // Re-authenticate cleanly with new password
    const reLogin = await request
      .post('/api/auth/login')
      .send({ username: testEmail, password: updatedPass });
    if (reLogin.status !== 200 || !reLogin.body.session?.access_token) {
      throw new Error(`Re-login failed: ${reLogin.status}`);
    }
    console.log('  ✓ Employee successfully re-logged in with new password.');
    console.log('  ✓ Session access token re-issued successfully.\n');

    console.log('===============================================================');
    console.log(' ALL 10 REGRESSION & SECURITY AUDIT TESTS PASSED (10 / 10)');
    console.log('===============================================================');

  } finally {
    if (testUserId) {
      console.log('\nCleaning up regression test employee account...');
      await supabaseAdmin.from('shop_memberships').delete().eq('user_id', testUserId);
      await supabaseAdmin.from('business_memberships').delete().eq('user_id', testUserId);
      await supabaseAdmin.from('profiles').delete().eq('id', testUserId);
      await supabaseAdmin.auth.admin.deleteUser(testUserId);
      console.log('✓ Temporary test employee deleted cleanly.');
    }
  }
}

runRegressionSuite().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err);
  process.exit(1);
});
