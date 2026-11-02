import { 
  handleListEmployees, 
  handleCreateEmployee, 
  handleReassignShop, 
  handleToggleStatus, 
  handleRevokeAccess 
} from '../_employees.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id, action } = req.query || {};

  // If queried with specific employee ID fallback
  if (id && typeof id === 'string') {
    if (req.method === 'DELETE') {
      return handleRevokeAccess(req, res, id);
    }
    if (req.method === 'PATCH') {
      if (action === 'shop' || (req.body && 'shopId' in req.body)) {
        return handleReassignShop(req, res, id);
      }
      if (action === 'status' || (req.body && 'isActive' in req.body)) {
        return handleToggleStatus(req, res, id);
      }
    }
  }

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
