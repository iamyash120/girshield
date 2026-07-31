import { Router, Response, Request } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { incidentRepository } from '../repositories/incident.repository';
import { alertRepository } from '../repositories/alert.repository';
import { notificationService } from '../services/notification.service';
import { broadcastIncidentUpdate } from '../config/socket';
import { z } from 'zod';

const router = Router();

const createIncidentSchema = z.object({
  village_id: z.string().uuid(),
  animal_id: z.string().uuid().optional(),
  type: z.enum(['livestock_attack', 'property_damage', 'human_encounter', 'human_injury', 'human_fatality', 'crop_damage']),
  title: z.string().min(5).max(300),
  description: z.string().min(10),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  photos: z.array(z.string()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  occurred_at: z.string().optional(),
});

router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, status, severity, villageId } = req.query as Record<string, string>;
  
  let queryParams: Record<string, string | undefined> = { page, limit, status: status as any, severity: severity as any };
  
  // Villagers only see their village incidents
  if (req.user!.role === 'villager') {
    const [user] = await require('../config/database').query(
      'SELECT village_id FROM users WHERE id = $1', [req.user!.userId]
    );
    queryParams.villageId = user?.village_id;
  } else if (req.user!.role === 'forest_officer') {
    queryParams.officerId = req.user!.userId;
  } else if (villageId) {
    queryParams.villageId = villageId;
  }
  
  const result = await incidentRepository.findAll(queryParams);
  sendSuccess(res, result.incidents, 'Incidents retrieved', 200, result.pagination);
}));

router.get('/stats', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  let villageId: string | undefined;
  if (req.user!.role === 'villager') {
    const [user] = await require('../config/database').query(
      'SELECT village_id FROM users WHERE id = $1', [req.user!.userId]
    );
    villageId = user?.village_id;
  }
  const stats = await incidentRepository.getStats(villageId);
  sendSuccess(res, stats, 'Stats retrieved');
}));

router.get('/trends', authenticate, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const trends = await incidentRepository.getMonthlyTrends(6);
  sendSuccess(res, trends, 'Trends retrieved');
}));

router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const incident = await incidentRepository.findById(req.params.id);
  if (!incident) return sendNotFound(res, 'Incident not found');
  sendSuccess(res, incident, 'Incident retrieved');
}));

router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createIncidentSchema.parse(req.body);
  const incident = await incidentRepository.create({
    ...data,
    reported_by: req.user!.userId,
    occurred_at: data.occurred_at ? new Date(data.occurred_at) : new Date(),
  });

  // Notify forest officers
  await notificationService.broadcastToRole('forest_officer', {
    type: 'incident',
    title: `New Incident: ${incident.title}`,
    body: `${incident.type.replace('_', ' ')} reported in a village. Severity: ${incident.severity}`,
    data: { incidentId: incident.id },
  });

  broadcastIncidentUpdate(incident as unknown as Record<string, unknown>);
  sendCreated(res, incident, 'Incident reported successfully');
}));

router.patch('/:id/status', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, notes } = req.body;
  const incident = await incidentRepository.updateStatus(
    req.params.id, status, req.user!.userId, notes
  );
  if (!incident) return sendNotFound(res, 'Incident not found');
  broadcastIncidentUpdate(incident as unknown as Record<string, unknown>);
  sendSuccess(res, incident, 'Incident status updated');
}));

export default router;
