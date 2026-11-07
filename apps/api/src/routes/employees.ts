import { Router, Request, Response } from 'express';
import { 
  CreateEmployeeSchema, 
  UpdateEmployeeShopSchema, 
  UpdateEmployeeStatusSchema,
  isDemoShop,
  type EmployeeRecord 
} from '@crimpston/shared';
import { requireOwnerAuth } from '../middleware/auth.js';
import { logSecurityEvent, logger } from '../logger.js';
import { supabaseAdmin } from '../supabase.js';

export const employeesRouter = Router();

/**
 * GET /api/employees
 * Returns all employee accounts assigned to the owner's business tenant.
 */
employeesRouter.get('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.isDemo) {
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
      .eq('business_id', user.businessId)
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
    logger.error('Failed to retrieve employees', { error: err?.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve employee directory.'
    });
  }
});

/**
 * POST /api/employees
 * Creates a new employee user account and assigns them to exactly one shop.
 */
employeesRouter.post('/', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = CreateEmployeeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation Error',
      message: parsed.error.issues[0]?.message || 'Invalid employee details.'
    });
  }

  const { name, email, username, shopId, password } = parsed.data;

  // Demo Sandbox Isolation
  if (user.isDemo) {
    return res.status(201).json({
      success: true,
      message: 'Demo employee account created and assigned.',
      employee: {
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
      }
    });
  }

  // 1. Verify target shop belongs to owner's business and is active
  const { data: shop, error: shopErr } = await supabaseAdmin
    .from('shops')
    .select('id, name, code, is_active, business_id')
    .eq('id', shopId)
    .maybeSingle();

  if (shopErr || !shop || shop.business_id !== user.businessId || !shop.is_active || isDemoShop(shop)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Selected shop is invalid, inactive, or unauthorized.'
    });
  }

  let targetUserId: string | null = null;
  let isNewlyCreatedAuth = false;

  try {
    // 2. Check if employee email is already registered in business_memberships
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
        .eq('business_id', user.businessId)
        .maybeSingle();

      if (existingMem) {
        return res.status(400).json({
          error: 'Conflict',
          message: 'An employee with this email is already registered for your business.'
        });
      }
      targetUserId = existingProfile.id;
    }

    if (!targetUserId) {
      // 3. Create or update Supabase Auth user with individual password
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

    // 5. Create business_memberships
    const { error: bmErr } = await supabaseAdmin
      .from('business_memberships')
      .upsert({
        business_id: user.businessId,
        user_id: targetUserId,
        role: 'employee',
        is_active: true
      }, { onConflict: 'business_id,user_id' });

    if (bmErr) throw bmErr;

    // 6. Assign to shop in shop_memberships (one shop per employee)
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

    logSecurityEvent({
      action: 'EMPLOYEE_CREATED',
      category: 'access_control',
      status: 'SUCCESS',
      statusCode: 201,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'employee',
      details: { action: 'created' }
    });

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
    // Saga compensation: If auth user was created but subsequent DB operations failed, cleanup
    if (isNewlyCreatedAuth && targetUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      } catch (cleanupErr: any) {
        logger.error('Failed to cleanup orphaned auth user during compensation', { error: cleanupErr?.message || 'Compensation error' });
      }
    }

    logger.error('Failed to create employee', { error: err?.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || 'Failed to provision employee account.'
    });
  }
});

/**
 * PATCH /api/employees/:id/shop
 * Reassigns an employee to a different retail shop within the owner's business.
 */
employeesRouter.patch('/:id/shop', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const employeeId = req.params.id as string;
  if (!employeeId) {
    return res.status(400).json({ error: 'Validation Error', message: 'Employee ID is required.' });
  }

  const parsed = UpdateEmployeeShopSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation Error',
      message: parsed.error.issues[0]?.message || 'Invalid shop ID.'
    });
  }

  const { shopId } = parsed.data;

  if (user.isDemo) {
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
      .eq('business_id', user.businessId)
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

    if (shopErr || !shop || shop.business_id !== user.businessId || !shop.is_active || isDemoShop(shop)) {
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

    logSecurityEvent({
      action: 'EMPLOYEE_REASSIGNED',
      category: 'access_control',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'employee',
      details: { action: 'reassigned' }
    });

    return res.status(200).json({
      success: true,
      message: `Employee reassigned to ${shop.name}.`,
      assignedShopId: shop.id,
      assignedShopName: shop.name
    });
  } catch (err: any) {
    logger.error('Failed to reassign employee shop', { error: err?.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update employee shop assignment.'
    });
  }
});

/**
 * PATCH /api/employees/:id/status
 * Toggles employee active / deactivated status.
 */
employeesRouter.patch('/:id/status', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const employeeId = req.params.id;

  const parsed = UpdateEmployeeStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid status value.'
    });
  }

  const { isActive } = parsed.data;

  if (user.isDemo) {
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
      .eq('business_id', user.businessId)
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
      .eq('business_id', user.businessId);

    if (updateErr) throw updateErr;

    logSecurityEvent({
      action: isActive ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_DEACTIVATED',
      category: 'access_control',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'employee',
      details: { isActive }
    });

    return res.status(200).json({
      success: true,
      message: isActive ? 'Employee account reactivated.' : 'Employee account deactivated.'
    });
  } catch (err: any) {
    logger.error('Failed to toggle employee status', { error: err?.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update employee account status.'
    });
  }
});

/**
 * DELETE /api/employees/:id
 * Revokes employee access completely from the business.
 */
employeesRouter.delete('/:id', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const employeeId = req.params.id;

  if (user.isDemo) {
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
      .eq('business_id', user.businessId)
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
      .eq('business_id', user.businessId);

    if (delErr) throw delErr;

    logSecurityEvent({
      action: 'EMPLOYEE_ACCESS_REVOKED',
      category: 'access_control',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'employee',
      details: { action: 'revoked' }
    });

    return res.status(200).json({
      success: true,
      message: 'Employee access revoked successfully.'
    });
  } catch (err: any) {
    logger.error('Failed to revoke employee access', { error: err?.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to revoke employee access.'
    });
  }
});

/**
 * POST /api/employees/:id/reset-password
 * Securely updates an employee's Supabase Auth password by the Business Owner.
 */
employeesRouter.post('/:id/reset-password', requireOwnerAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const employeeId = req.params.id;
  const { password } = req.body || {};

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Password must be at least 8 characters long.'
    });
  }

  if (user.isDemo) {
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
      .eq('business_id', user.businessId)
      .maybeSingle();

    if (memErr || !mem || mem.role !== 'employee') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Employee not found in your business directory.'
      });
    }

    // 2. Verify Supabase Auth user exists and retrieve profile
    const { data: authUser, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(employeeId!);
    if (authUserErr || !authUser?.user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Auth account for this employee was not found in Supabase Auth.'
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', employeeId!)
      .maybeSingle();

    // 3. Update password in Supabase Auth and ensure email is confirmed
    const { data: updateData, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(employeeId!, {
      password,
      email_confirm: true
    });

    if (updateErr || !updateData?.user) {
      return res.status(500).json({
        error: 'Update Error',
        message: updateErr?.message || 'Failed to reset employee password in Supabase Auth.'
      });
    }

    logSecurityEvent({
      action: 'EMPLOYEE_PASSWORD_RESET',
      category: 'access_control',
      status: 'SUCCESS',
      statusCode: 200,
      correlationId: (req.headers['x-correlation-id'] as string),
      resourceType: 'employee',
      details: { employeeId }
    });

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
});
