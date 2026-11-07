import { supabaseAnon, supabaseAdmin } from '../_supabase.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing recovery session token.'
    });
  }

  const token = authHeader.split(' ')[1];
  const { password } = req.body || {};

  if (!password || typeof password !== 'string' || password.length < 12) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 12 characters long.'
    });
  }

  try {
    const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired recovery session token.'
      });
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password
    });

    if (updateErr) {
      return res.status(500).json({
        success: false,
        message: updateErr.message || 'Failed to update password.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password successfully updated.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Internal server error while updating password.'
    });
  }
}
