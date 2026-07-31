import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { villageRepository } from '../repositories/village.repository';
import { query } from '../config/database';
import { z } from 'zod';

const router = Router();

const createVillageSchema = z.object({
  name: z.string().min(2).max(100),
  taluka: z.string().min(2).max(100),
  district: z.string().optional().default('Junagadh'),
  latitude: z.number().min(20).max(23),
  longitude: z.number().min(69).max(73),
  population: z.number().optional(),
  households: z.number().optional(),
  buffer_zone_km: z.number().optional(),
});

// GET /api/villages
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, riskLevel } = req.query as Record<string, string>;
  const result = await villageRepository.findAll(page, limit, search, riskLevel as any);
  sendSuccess(res, result.villages, 'Villages retrieved', 200, result.pagination);
}));

// GET /api/villages/high-risk
router.get('/high-risk', asyncHandler(async (_req: Request, res: Response) => {
  const villages = await villageRepository.getHighRiskVillages();
  sendSuccess(res, villages, 'High risk villages retrieved');
}));

// GET /api/villages/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const village = await villageRepository.findById(req.params.id);
  if (!village) return sendNotFound(res, 'Village not found');
  sendSuccess(res, village, 'Village retrieved');
}));

// GET /api/villages/:id/stats
router.get('/:id/stats', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const [stats] = await query(
    `SELECT 
      v.name,
      v.risk_level,
      v.population,
      (SELECT COUNT(*) FROM incidents i WHERE i.village_id = v.id) as total_incidents,
      (SELECT COUNT(*) FROM incidents i WHERE i.village_id = v.id AND i.status != 'closed') as active_incidents,
      (SELECT COUNT(*) FROM alerts a WHERE a.village_id = v.id AND a.is_active = TRUE) as active_alerts,
      (SELECT COUNT(*) FROM users u WHERE u.village_id = v.id AND u.role = 'villager') as registered_users,
      (SELECT COUNT(*) FROM compensation_claims cc 
       JOIN incidents i ON i.id = cc.incident_id WHERE i.village_id = v.id) as compensation_claims
     FROM villages v WHERE v.id = $1`,
    [id]
  );
  if (!stats) return sendNotFound(res, 'Village not found');
  sendSuccess(res, stats, 'Village stats retrieved');
}));

// POST /api/villages - Admin only
router.post('/', authenticate, authorize('admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createVillageSchema.parse(req.body);
  const village = await villageRepository.create(data);
  sendCreated(res, village, 'Village created');
}));

// PUT /api/villages/:id - Admin only
router.put('/:id', authenticate, authorize('admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const village = await villageRepository.update(req.params.id, req.body);
  if (!village) return sendNotFound(res, 'Village not found');
  sendSuccess(res, village, 'Village updated');
}));

export default router;
