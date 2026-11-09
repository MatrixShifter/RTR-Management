import { 
  handleListEmployees, 
  handleCreateEmployee, 
  handleReassignShop, 
  handleToggleStatus, 
  handleRevokeAccess,
  handleResetPassword
} from './_employees.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  let { id, action } = req.query || {};
  if (Array.isArray(id)) id = id[0];
  if (Array.isArray(action)) action = action[0];

  // URL fallback parsing if rewrites didn't inject query
  if ((!id || !action) && req.url) {
    const urlMatch = req.url.match(/\/api\/employees\/([^\/\?]+)(?:\/([^\/\?]+))?/);
    if (urlMatch) {
      if (!id) id = urlMatch[1];
      if (!action && urlMatch[2]) action = urlMatch[2];
    }
  }

  // If queried with specific employee ID
  if (id && typeof id === 'string') {
    if (action === 'reset-password') {
      if (req.method === 'POST') {
        return handleResetPassword(req, res, id);
      }
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `Method ${req.method} is not supported on /api/employees/${id}/reset-password.`
      });
    }

    if (action === 'shop') {
      if (req.method === 'PATCH') {
        return handleReassignShop(req, res, id);
      }
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `Method ${req.method} is not supported on /api/employees/${id}/shop.`
      });
    }

    if (action === 'status') {
      if (req.method === 'PATCH') {
        return handleToggleStatus(req, res, id);
      }
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `Method ${req.method} is not supported on /api/employees/${id}/status.`
      });
    }

    // Direct PATCH fallback if action isn't specified in path but payload defines it
    if (req.method === 'PATCH') {
      if (req.body && 'shopId' in req.body) {
        return handleReassignShop(req, res, id);
      }
      if (req.body && 'isActive' in req.body) {
        return handleToggleStatus(req, res, id);
      }
    }

    if (req.method === 'DELETE') {
      return handleRevokeAccess(req, res, id);
    }

    return res.status(405).json({
      error: 'Method Not Allowed',
      message: `Method ${req.method} is not supported on /api/employees/${id}.`
    });
  }

  // Collection-level endpoints (/api/employees)
  if (req.method === 'GET') {
    return handleListEmployees(req, res);
  }

  if (req.method === 'POST') {
    return handleCreateEmployee(req, res);
  }

  return res.status(405).json({
    error: 'Method Not Allowed',
    message: `Method ${req.method} is not supported on /api/employees.`
  });
}

export const employeeIdHandler = (req: any, res: any) => handler(req, res);
export const employeeShopHandler = (req: any, res: any) => {
  if (req.query && !req.query.action) req.query.action = 'shop';
  return handler(req, res);
};
export const employeeStatusHandler = (req: any, res: any) => {
  if (req.query && !req.query.action) req.query.action = 'status';
  return handler(req, res);
};
export const employeeResetPasswordHandler = (req: any, res: any) => {
  if (req.query && !req.query.action) req.query.action = 'reset-password';
  return handler(req, res);
};
