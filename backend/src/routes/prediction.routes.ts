import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { predictionAgent } from '../agents/prediction.agent';
import { alertAgent } from '../agents/alert.agent';
import { broadcastAlert } from '../config/socket';
import { z } from 'zod';

const router = Router();

const predictionSchema = z.object({
  animalId: z.string().uuid().optional(),
  species: z.enum(['asiatic_lion', 'leopard', 'hyena', 'wolf', 'other']),
  currentLat: z.number(),
  currentLng: z.number(),
  timeOfDay: z.enum(['dawn', 'morning', 'afternoon', 'dusk', 'night']),
  season: z.enum(['summer', 'monsoon', 'winter']),
  temperature: z.number().optional(),
  weather: z.string().optional(),
  triggerAlerts: z.boolean().default(false),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, species, level } = req.query as Record<string, string>;
  const result = await predictionAgent.getPredictions({ page, limit, species: species as any, level: level as any });
  sendSuccess(res, result.predictions, 'Predictions retrieved', 200, {
    page: parseInt(page || '1'), limit: parseInt(limit || '20'), total: result.total,
    totalPages: Math.ceil(result.total / parseInt(limit || '20'))
  });
}));

router.post('/run', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = predictionSchema.parse(req.body);
  const prediction = await predictionAgent.predict(data);

  // If triggerAlerts is requested and threat is significant
  if (data.triggerAlerts && (prediction.alert_level === 'high' || prediction.alert_level === 'critical')) {
    const alerts = await alertAgent.processAndBroadcast({
      predictionId: prediction.id,
      species: data.species,
      threatScore: prediction.threat_score,
      alertLevel: prediction.alert_level,
      predictedLat: prediction.predicted_latitude,
      predictedLng: prediction.predicted_longitude,
      affectedVillageIds: prediction.affected_village_ids || [],
      animalId: data.animalId,
    });
    alerts.forEach(a => broadcastAlert(a.village_id, a as unknown as Record<string, unknown>));
    sendSuccess(res, { prediction, alerts }, 'Prediction complete and alerts triggered');
  } else {
    sendCreated(res, prediction, 'Prediction generated successfully');
  }
}));

export default router;
