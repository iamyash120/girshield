import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { animalRepository } from '../repositories/animal.repository';
import { z } from 'zod';

const router = Router();

const createAnimalSchema = z.object({
  name: z.string().min(2).max(100),
  species: z.enum(['asiatic_lion', 'leopard', 'hyena', 'wolf', 'other']),
  gender: z.enum(['male', 'female', 'unknown']).default('unknown'),
  age_estimate_years: z.number().optional(),
  collar_id: z.string().optional(),
  is_gps_tagged: z.boolean().default(false),
  health_status: z.enum(['healthy', 'injured', 'unknown']).default('unknown'),
  notes: z.string().optional(),
});

const movementSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().optional(),
  speed_kmph: z.number().optional(),
  heading_degrees: z.number().optional(),
  recorded_at: z.string().optional(),
  source: z.enum(['gps_collar', 'field_observation', 'camera_trap', 'ai_prediction']).default('field_observation'),
  confidence: z.number().optional(),
  notes: z.string().optional(),
});

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, species, isGpsTagged } = req.query as Record<string, string>;
  const result = await animalRepository.findAll(
    page, limit, species as any, isGpsTagged !== undefined ? isGpsTagged === 'true' : undefined
  );
  sendSuccess(res, result.animals, 'Animals retrieved', 200, result.pagination);
}));

router.get('/recent-sightings', asyncHandler(async (req: Request, res: Response) => {
  const hours = parseInt(req.query.hours as string || '24');
  const sightings = await animalRepository.getRecentSightings(hours);
  sendSuccess(res, sightings, 'Recent sightings retrieved');
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const animal = await animalRepository.findById(req.params.id);
  if (!animal) return sendNotFound(res, 'Animal not found');
  sendSuccess(res, animal, 'Animal retrieved');
}));

router.get('/:id/movements', asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string || '7');
  const movements = await animalRepository.getMovementHistory(req.params.id, days);
  sendSuccess(res, movements, 'Movement history retrieved');
}));

router.post('/', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createAnimalSchema.parse(req.body);
  const animal = await animalRepository.create(data);
  sendCreated(res, animal, 'Animal record created');
}));

router.post('/:id/movements', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = movementSchema.parse(req.body);
  const movement = await animalRepository.recordMovement({
    ...data,
    animal_id: req.params.id,
    recorded_at: data.recorded_at ? new Date(data.recorded_at) : new Date(),
  });
  sendCreated(res, movement, 'Movement recorded');
}));

router.put('/:id', authenticate, authorize('forest_officer', 'admin', 'super_admin'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const animal = await animalRepository.update(req.params.id, req.body);
  if (!animal) return sendNotFound(res, 'Animal not found');
  sendSuccess(res, animal, 'Animal updated');
}));

export default router;
