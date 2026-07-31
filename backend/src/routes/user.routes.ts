import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { z } from 'zod';

const router = Router();

// GET /api/users - Admin only, list all users with village info
router.get('/', authenticate, authorize('admin', 'super_admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '20', search, role } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE u.is_active = TRUE';
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    where += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.phone ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (role) { where += ` AND u.role = $${idx++}`; params.push(role); }

  const [count] = await query<{ count: string }>(`SELECT COUNT(*) FROM users u ${where}`, params);
  params.push(parseInt(limit), offset);

  const users = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_verified, u.is_active, u.created_at, u.last_login_at,
            v.name as village_name
     FROM users u LEFT JOIN villages v ON v.id = u.village_id
     ${where} ORDER BY u.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  sendSuccess(res, users, 'Users retrieved', 200, {
    page: parseInt(page), limit: parseInt(limit),
    total: parseInt(count?.count || '0'),
    totalPages: Math.ceil(parseInt(count?.count || '0') / parseInt(limit))
  });
}));

// GET /api/users/:id - Admin only
router.get('/:id', authenticate, authorize('admin', 'super_admin', 'forest_officer'), asyncHandler(async (req: Request, res: Response) => {
  const [user] = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_verified, u.is_active, u.created_at, v.name as village_name
     FROM users u LEFT JOIN villages v ON v.id = u.village_id
     WHERE u.id = $1`,
    [req.params.id]
  );
  if (!user) return sendNotFound(res, 'User not found');
  sendSuccess(res, user, 'User retrieved');
}));

// PATCH /api/users/:id/status - Admin toggle active
router.patch('/:id/status', authenticate, authorize('admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { is_active } = z.object({ is_active: z.boolean() }).parse(req.body);
  const [user] = await query(
    'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_active',
    [is_active, req.params.id]
  );
  if (!user) return sendNotFound(res, 'User not found');
  sendSuccess(res, user, `User ${is_active ? 'activated' : 'deactivated'}`);
}));

export default router;
