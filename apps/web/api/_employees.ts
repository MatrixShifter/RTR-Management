import { 
  CreateEmployeeSchema, 
  UpdateEmployeeShopSchema, 
  UpdateEmployeeStatusSchema, 
  isDemoShop,
  type EmployeeRecord 
} from '@crimpston/shared';
import { supabaseAdmin } from './_supabase.js';

export interface AuthenticatedOwner {
  id: string;
  email: string;
  businessId: string;
  isDemo: boolean;
}

/**
 * Authenticates the caller and verifies Business Owner permissions.
 * Supports both production Supabase JWTs and isolated demo sandbox tokens.
 */
export async function authenticateOwner(req: any, res: any): Promise<AuthenticatedOwner | null> {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required.'
    });
    return null;
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid session token format.'
    });
    return null;
  }

  // 1. Demo sandbox handling
  if (token.startsWith('demo-session-') || token.startsWith('demo-access-token-') || token.startsWith('demo-')) {
    return {
      id: 'demo-owner-00000000-0000-0000-0000-000000000000',
      email: 'demo-owner@rtrmobiles.com',
      businessId: 'demo-business-00000000-0000-0000-0000-000000000000',
      isDemo: true
    };
  }

  // 2. Real Supabase Auth session verification
  try {
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token.'
      });
      return null;
    }

    // Role verification against business_memberships
    const { data: membership, error: memErr } = await supabaseAdmin
      .from('business_memberships')
      .select('business_id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memErr || !membership || !membership.is_active) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated or unauthorized.'
      });
      return null;
    }

    if (membership.role !== 'owner') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Business Owner privileges required.'
      });
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      businessId: membership.business_id,
      isDemo: false
    };
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify authentication credentials.'
    });
    return null;
  }
}

/**
 * GET /api/employees
 * Lists all employees belonging to the owner's business tenant.
 */
export async function handleListEmployees(req: any, res: any) {
  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  if (owner.isDemo) {
    return res.status(200).json({
      employees: [
        {
          id: 'demo-employee-1',
          name: 'Demo Staff Member',
          email: 'staff@rtrmobiles.com',
          username: 'staff',
          role: 'employee',
          isActive: true,
          assignedShopId: 'demo-shop-1',
          assignedShopName: 'Demo Retail Shop',
          assignedShopCode: 'DEMO-01',
          createdAt: new Date().toISOString()
        }
      ]
    });
  }

  try {
    // 1. Fetch memberships for this business with role = employee
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('business_memberships')
      .select('user_id, role, is_active, created_at')
      .eq('business_id', owner.businessId)
      .eq('role', 'employee')
      .order('created_at', { ascending: false });

    if (memErr) throw memErr;
    if (!memberships || memberships.length === 0) {
      return res.status(200).json({ employees: [] });
    }

    const userIds = memberships.map(m => m.user_id);

    // 2. Fetch profiles
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, username')
      .in('id', userIds);

    if (profErr) throw profErr;

    // 3. Fetch shop memberships with shops
    const { data: shopMembers, error: smErr } = await supabaseAdmin
      .from('shop_memberships')
      .select('user_id, shop_id, shops(id, name, code, is_active)')
      .in('user_id', userIds);

    if (smErr) throw smErr;

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const shopMap = new Map((shopMembers || []).map(sm => [sm.user_id, sm]));

    const employees: EmployeeRecord[] = memberships.map(m => {
      const prof = profileMap.get(m.user_id);
      const sm = shopMap.get(m.user_id);
      const shop = (sm as any)?.shops;

      return {
        id: m.user_id,
        name: prof?.full_name || 'Staff Member',
        email: prof?.email || '',
        username: prof?.username || undefined,
        role: 'employee',
        isActive: m.is_active,
        assignedShopId: sm?.shop_id || '',
        assignedShopName: shop?.name || 'Unassigned',
        assignedShopCode: shop?.code || '—',
        createdAt: m.created_at
      };
    });

    return res.status(200).json({ employees });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to retrieve employee directory.'
    });
  }
}

/**
 * POST /api/employees
 * Provisions an employee Supabase Auth account and assigns them to an active retail shop.
 */
export async function handleCreateEmployee(req: any, res: any) {
  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  const parsed = CreateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation Error',
      message: parsed.error.issues[0]?.message || 'Invalid employee details.'
    });
  }

  const { name, email, username, shopId, password } = parsed.data;

  // Handle Demo Mode
  if (owner.isDemo) {
    const demoEmployee: EmployeeRecord = {
      id: `demo-employee-${Date.now()}`,
      name,
      email,
      username: username || email.split('@')[0],
      role: 'employee',
      isActive: true,
      assignedShopId: shopId,
      assignedShopName: 'Demo Retail Shop',
      assignedShopCode: 'DEMO-01',
      createdAt: new Date().toISOString()
    };
    return res.status(201).json({
      success: true,
      message: 'Demo employee account created and assigned.',
      employee: demoEmployee
    });
  }

  // 1. Verify target shop belongs to owner's business tenant and is active
  const { data: shop, error: shopErr } = await supabaseAdmin
    .from('shops')
    .select('id, name, code, is_active, business_id')
    .eq('id', shopId)
    .maybeSingle();

  if (shopErr || !shop || shop.business_id !== owner.businessId || !shop.is_active || isDemoShop(shop)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Selected shop is invalid, inactive, or unauthorized.'
    });
  }

  let targetUserId: string | null = null;
  let isNewlyCreatedAuth = false;

  try {
    // 2. Check if employee email is already registered in this business
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data: existingMem } = await supabaseAdmin
        .from('business_memberships')
        .select('id, business_id')
        .eq('user_id', existingProfile.id)
        .eq('business_id', owner.businessId)
        .maybeSingle();

      if (existingMem) {
        return res.status(400).json({
          error: 'Conflict',
          message: 'An employee with this email is already registered for your business.'
        });
      }
      targetUserId = existingProfile.id;
    }

    // 3. Provision or update password in Supabase Auth
    if (!targetUserId) {
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          username: username || email.split('@')[0],
          role: 'employee'
        }
      });

      if (createErr || !newUser?.user) {
        // If already registered in auth.users, resolve ID and update password
        const errMsg = createErr?.message || '';
        if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists')) {
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          const found = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (found) {
            targetUserId = found.id;
            await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
              password,
              email_confirm: true
            });
          } else {
            throw new Error(errMsg || 'Failed to provision auth user.');
          }
        } else {
          throw new Error(errMsg || 'Failed to provision auth user.');
        }
      } else {
        targetUserId = newUser.user.id;
        isNewlyCreatedAuth = true;
      }
    } else {
      // Update existing user with the individual password
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password,
        email_confirm: true
      });
    }

    // 4. Upsert profile
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: targetUserId,
      email,
      full_name: name,
      username: username || email.split('@')[0]
    });
    if (profErr) throw profErr;

    // 5. Upsert business_memberships
    const { error: bmErr } = await supabaseAdmin
      .from('business_memberships')
      .upsert({
        business_id: owner.businessId,
        user_id: targetUserId,
        role: 'employee',
        is_active: true
      }, { onConflict: 'business_id,user_id' });
    if (bmErr) throw bmErr;

    // 6. Assign exactly one active shop in shop_memberships
    await supabaseAdmin
      .from('shop_memberships')
      .delete()
      .eq('user_id', targetUserId);

    const { error: smErr } = await supabaseAdmin
      .from('shop_memberships')
      .insert({
        shop_id: shopId,
        user_id: targetUserId
      });
    if (smErr) throw smErr;

    const newEmployee: EmployeeRecord = {
      id: targetUserId,
      name,
      email,
      username,
      role: 'employee',
      isActive: true,
      assignedShopId: shop.id,
      assignedShopName: shop.name,
      assignedShopCode: shop.code,
      createdAt: new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      message: `Employee account created and assigned to ${shop.name}.`,
      employee: newEmployee
    });
  } catch (err: any) {
    // Saga compensation: If new auth user was created but DB setup failed, delete auth record
    if (isNewlyCreatedAuth && targetUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      } catch (cleanupErr) {
        console.error('Failed to cleanup orphaned auth user during compensation:', cleanupErr);
      }
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to provision employee account.'
    });
  }
}

/**
 * PATCH /api/employees/:id/shop
 * Reassigns an employee to a different retail shop within the owner's business tenant.
 */
export async function handleReassignShop(req: any, res: any, employeeId: string) {
  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  const parsed = UpdateEmployeeShopSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation Error',
      message: parsed.error.issues[0]?.message || 'Invalid shop ID.'
    });
  }

  const { shopId } = parsed.data;

  if (owner.isDemo) {
    return res.status(200).json({
      success: true,
      message: 'Demo employee reassigned.',
      assignedShopId: shopId,
      assignedShopName: 'Assigned Shop'
    });
  }

  try {
    // 1. Verify employee belongs to owner's business
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('business_memberships')
      .select('id, role, is_active')
      .eq('user_id', employeeId)
      .eq('business_id', owner.businessId)
      .maybeSingle();

    if (memErr || !mem || mem.role !== 'employee') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found in your business directory.'
      });
    }

    // 2. Verify new shop belongs to business and is active
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from('shops')
      .select('id, name, code, is_active, business_id')
      .eq('id', shopId)
      .maybeSingle();

    if (shopErr || !shop || shop.business_id !== owner.businessId || !shop.is_active || isDemoShop(shop)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Selected target shop is invalid, inactive, or unauthorized.'
      });
    }

    // 3. Atomically update shop assignment
    await supabaseAdmin
      .from('shop_memberships')
      .delete()
      .eq('user_id', employeeId);

    const { error: assignErr } = await supabaseAdmin
      .from('shop_memberships')
      .insert({
        shop_id: shopId,
        user_id: employeeId
      });

    if (assignErr) throw assignErr;

    return res.status(200).json({
      success: true,
      message: `Employee reassigned to ${shop.name}.`,
      assignedShopId: shop.id,
      assignedShopName: shop.name
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to update employee shop assignment.'
    });
  }
}

/**
 * PATCH /api/employees/:id/status
 * Toggles an employee's active or deactivated status.
 */
export async function handleToggleStatus(req: any, res: any, employeeId: string) {
  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  const parsed = UpdateEmployeeStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid status value.'
    });
  }

  const { isActive } = parsed.data;

  if (owner.isDemo) {
    return res.status(200).json({
      success: true,
      message: isActive ? 'Demo employee reactivated.' : 'Demo employee deactivated.'
    });
  }

  try {
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('business_memberships')
      .select('id, role')
      .eq('user_id', employeeId)
      .eq('business_id', owner.businessId)
      .maybeSingle();

    if (memErr || !mem || mem.role !== 'employee') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found in your business directory.'
      });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('business_memberships')
      .update({ is_active: isActive })
      .eq('user_id', employeeId)
      .eq('business_id', owner.businessId);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      message: isActive ? 'Employee account reactivated.' : 'Employee account deactivated.'
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to update employee account status.'
    });
  }
}

/**
 * DELETE /api/employees/:id
 * Revokes employee access completely from the business tenant.
 */
export async function handleRevokeAccess(req: any, res: any, employeeId: string) {
  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  if (owner.isDemo) {
    return res.status(200).json({
      success: true,
      message: 'Demo employee access revoked.'
    });
  }

  try {
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('business_memberships')
      .select('id, role')
      .eq('user_id', employeeId)
      .eq('business_id', owner.businessId)
      .maybeSingle();

    if (memErr || !mem || mem.role !== 'employee') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found in your business directory.'
      });
    }

    // 1. Remove shop membership
    await supabaseAdmin
      .from('shop_memberships')
      .delete()
      .eq('user_id', employeeId);

    // 2. Remove business membership
    const { error: delErr } = await supabaseAdmin
      .from('business_memberships')
      .delete()
      .eq('user_id', employeeId)
      .eq('business_id', owner.businessId);

    if (delErr) throw delErr;

    return res.status(200).json({
      success: true,
      message: 'Employee access revoked successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to revoke employee access.'
    });
  }
}

/**
 * POST /api/employees/:id/reset-password
 * Securely updates an employee's Supabase Auth password by the Business Owner.
 */
export async function handleResetPassword(req: any, res: any, employeeId: string) {
  const owner = await authenticateOwner(req, res);
  if (!owner) return;

  const { password } = req.body || {};
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Password must be at least 8 characters long.'
    });
  }

  if (owner.isDemo) {
    return res.status(200).json({
      success: true,
      message: 'Demo employee password reset successfully.'
    });
  }

  try {
    const { data: mem, error: memErr } = await supabaseAdmin
      .from('business_memberships')
      .select('id, role, is_active')
      .eq('user_id', employeeId)
      .eq('business_id', owner.businessId)
      .maybeSingle();

    if (memErr || !mem || mem.role !== 'employee') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found in your business directory.'
      });
    }

    // 2. Verify Supabase Auth user exists and retrieve profile
    const { data: authUser, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(employeeId);
    if (authUserErr || !authUser?.user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Auth account for this employee was not found in Supabase Auth.'
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', employeeId)
      .maybeSingle();

    // 3. Update password in Supabase Auth and ensure email is confirmed
    const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(employeeId, {
      password,
      email_confirm: true
    });

    if (updateErr || !updateData?.user) {
      return res.status(500).json({
        error: 'Update Error',
        message: updateErr?.message || 'Failed to reset employee password in Supabase Auth.'
      });
    }

    const displayName = profile?.full_name || authUser.user.email || 'Employee';
    return res.status(200).json({
      success: true,
      message: `Password for ${displayName} updated successfully.`
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to reset employee password.'
    });
  }
}
