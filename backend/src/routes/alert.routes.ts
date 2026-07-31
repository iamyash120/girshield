import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { alertRepository } from '../repositories/alert.repository';
import { alertAgent } from '../agents/alert.agent';
import { predictionAgent } from '../agents/prediction.agent';
import { broadcastAlert } from '../config/socket';
import { z } from 'zod';
import { AnimalSpecies } from '../types';

const router = Router();

const createAlertSchema = z.object({
  animal_id: z.string().uuid().optional(),
  village_id: z.string().uuid(),
  level: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(5).max(300),
  message: z.string().min(10),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius_km: z.number().optional().default(5),
  expires_at: z.string().optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, villageId, level, isActive } = req.query as Record<string, string>;
  const result = await alertRepository.findAll(
    page, limit, villageId, level as any,
    isActive !== undefined ? isActive === 'true' : undefined
  );
  sendSuccess(res, result.alerts, 'Alerts retrieved', 200, result.pagination);
}));

router.get('/critical', asyncHandler(async (_req: Request, res: Response) => {
  const alerts = await alertRepository.getActiveCriticalAlerts();
  sendSuccess(res, alerts, 'Critical alerts retrieved');
}));

router.get('/village/:villageId', asyncHandler(async (req: Request, res: Response) => {
  const alerts = await alertRepository.getActiveAlertsForVillage(req.params.villageId);
  sendSuccess(res, alerts, 'Village alerts retrieved');
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const alert = await alertRepository.findById(req.params.id);
  if (!alert) return sendNotFound(res, 'Alert not found');
  sendSuccess(res, alert, 'Alert retrieved');
}));

router.post('/', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createAlertSchema.parse(req.body);
  const alert = await alertRepository.create({
    ...data,
    expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
    created_by: req.user!.userId,
  });
  broadcastAlert(alert.village_id, alert as unknown as Record<string, unknown>);
  sendCreated(res, alert, 'Alert created');
}));

// Trigger AI-powered alert broadcast
router.post('/ai-broadcast', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    species: z.enum(['asiatic_lion', 'leopard', 'hyena', 'wolf', 'other']),
    threatScore: z.number().min(0).max(1),
    alertLevel: z.enum(['low', 'medium', 'high', 'critical']),
    predictedLat: z.number(),
    predictedLng: z.number(),
    affectedVillageIds: z.array(z.string().uuid()),
    animalId: z.string().uuid().optional(),
  });
  
  const data = schema.parse(req.body);
  const alerts = await alertAgent.processAndBroadcast(data);
  
  alerts.forEach(a => broadcastAlert(a.village_id, a as unknown as Record<string, unknown>));
  sendSuccess(res, alerts, `${alerts.length} alerts broadcast successfully`);
}));

router.patch('/:id/acknowledge', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await alertRepository.incrementAcknowledged(req.params.id);
  sendSuccess(res, null, 'Alert acknowledged');
}));

router.delete('/:id', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: Request, res: Response) => {
  await alertRepository.deactivate(req.params.id);
  sendSuccess(res, null, 'Alert deactivated');
}));

export default router;
