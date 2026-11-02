import { handleSendOtp } from '../../_employees.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const { id } = req.query || {};
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Employee ID is required.'
    });
  }

  if (req.method === 'POST') {
    return handleSendOtp(req, res, id);
  }

  return res.status(405).json({
    error: 'Method Not Allowed',
    message: `Method ${req.method} is not supported on /api/employees/${id}/send-otp.`
  });
}
