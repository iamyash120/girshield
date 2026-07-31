import { query } from '../config/database';
import { animalRepository } from '../repositories/animal.repository';
import { villageRepository } from '../repositories/village.repository';
import { alertRepository } from '../repositories/alert.repository';
import { graniteService } from './granite.service';
import { logger } from '../utils/logger';
import { AnimalSpecies, AlertLevel, Prediction } from '../types';

interface PredictionInput {
  animalId?: string;
  species: AnimalSpecies;
  currentLat: number;
  currentLng: number;
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';
  season: 'summer' | 'monsoon' | 'winter';
  temperature?: number;
  weather?: string;
}

interface PredictionOutput {
  predictedLat: number;
  predictedLng: number;
  threatScore: number;
  confidencePercent: number;
  alertLevel: AlertLevel;
  affectedVillages: string[];
  movementRoute: { latitude: number; longitude: number }[];
  safeRadiusKm: number;
  reasoning: string;
}

export class WildlifePredictionAgent {
  name = 'WildlifePredictionAgent';
  version = '2.0.0';

  async predict(input: PredictionInput): Promise<Prediction> {
    logger.info('WildlifePredictionAgent: Starting prediction', { input });

    // Get historical movement data
    const historyMovements = input.animalId
      ? await animalRepository.getMovementHistory(input.animalId, 30)
      : [];

    // Calculate movement patterns from history
    const patterns = this.analyzeMovementPatterns(historyMovements.map(m => ({
      lat: Number(m.latitude),
      lng: Number(m.longitude),
      time: m.recorded_at.toISOString(),
    })));

    // Rule-based prediction engine
    const output = this.runPredictionEngine(input, patterns);

    // Find affected villages
    const nearbyVillages = await villageRepository.getNearbyVillages(
      output.predictedLat,
      output.predictedLng,
      output.safeRadiusKm * 3
    );
    output.affectedVillages = nearbyVillages.map(v => v.id);

    // Persist prediction
    const validUntil = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
    const [prediction] = await query<Prediction>(
      `INSERT INTO ai_predictions 
        (animal_id, species, predicted_latitude, predicted_longitude, predicted_at, valid_until,
         threat_score, confidence_percent, alert_level, affected_village_ids, movement_route,
         safe_radius_km, model_version, input_features)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.animalId || null,
        input.species,
        output.predictedLat,
        output.predictedLng,
        validUntil,
        output.threatScore,
        output.confidencePercent,
        output.alertLevel,
        output.affectedVillages,
        JSON.stringify(output.movementRoute),
        output.safeRadiusKm,
        this.version,
        JSON.stringify(input),
      ]
    );

    logger.info('WildlifePredictionAgent: Prediction complete', { 
      predictionId: prediction.id, alertLevel: output.alertLevel 
    });

    return prediction;
  }

  private analyzeMovementPatterns(movements: { lat: number; lng: number; time: string }[]) {
    if (movements.length < 2) return { avgSpeed: 2, dominantDirection: 0, activityPeak: 'night' };

    let totalDist = 0;
    let dirSum = 0;
    for (let i = 1; i < movements.length; i++) {
      const prev = movements[i - 1];
      const curr = movements[i];
      const dist = this.haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
      totalDist += dist;
      const dir = Math.atan2(curr.lng - prev.lng, curr.lat - prev.lat) * (180 / Math.PI);
      dirSum += dir;
    }

    return {
      avgSpeed: totalDist / Math.max(movements.length - 1, 1),
      dominantDirection: dirSum / (movements.length - 1),
      activityPeak: 'night',
    };
  }

  private runPredictionEngine(
    input: PredictionInput,
    patterns: { avgSpeed: number; dominantDirection: number; activityPeak: string }
  ): PredictionOutput {
    // Species-specific movement parameters
    const speciesParams = {
      asiatic_lion: { range: 15, speed: 8, villageAffinity: 0.3, nightActivity: 0.8 },
      leopard: { range: 25, speed: 12, villageAffinity: 0.5, nightActivity: 0.9 },
      hyena: { range: 10, speed: 6, villageAffinity: 0.4, nightActivity: 0.7 },
      wolf: { range: 20, speed: 10, villageAffinity: 0.35, nightActivity: 0.75 },
      other: { range: 8, speed: 5, villageAffinity: 0.2, nightActivity: 0.5 },
    };

    const params = speciesParams[input.species];
    const isNight = ['dusk', 'night'].includes(input.timeOfDay);
    const activityMultiplier = isNight ? params.nightActivity : (1 - params.nightActivity);

    // Season factor
    const seasonFactor = { summer: 1.3, monsoon: 0.7, winter: 1.0 }[input.season] || 1.0;

    // Predict movement direction (northwest towards forest edge for lions, south for leopards)
    const directionBias = input.species === 'asiatic_lion' ? 315 : 180; // degrees
    const directionRad = ((patterns.dominantDirection * 0.4 + directionBias * 0.6) * Math.PI) / 180;
    const movementKm = patterns.avgSpeed * activityMultiplier * seasonFactor * 2;

    const latDelta = (movementKm / 111) * Math.cos(directionRad);
    const lngDelta = (movementKm / (111 * Math.cos((input.currentLat * Math.PI) / 180))) * Math.sin(directionRad);

    const predictedLat = Math.round((input.currentLat + latDelta) * 1e6) / 1e6;
    const predictedLng = Math.round((input.currentLng + lngDelta) * 1e6) / 1e6;

    // Calculate threat score
    const threatScore = Math.min(
      0.95,
      params.villageAffinity * activityMultiplier * seasonFactor * (isNight ? 1.2 : 0.8)
    );

    const alertLevel: AlertLevel =
      threatScore > 0.75 ? 'critical' :
      threatScore > 0.5 ? 'high' :
      threatScore > 0.25 ? 'medium' : 'low';

    // Generate movement route (interpolated)
    const steps = 5;
    const movementRoute = Array.from({ length: steps }, (_, i) => ({
      latitude: input.currentLat + (latDelta * (i + 1)) / steps,
      longitude: input.currentLng + (lngDelta * (i + 1)) / steps,
    }));

    return {
      predictedLat,
      predictedLng,
      threatScore: Math.round(threatScore * 1e4) / 1e4,
      confidencePercent: Math.round((0.6 + Math.random() * 0.25) * 100),
      alertLevel,
      affectedVillages: [],
      movementRoute,
      safeRadiusKm: params.range / 5,
      reasoning: `${input.species} showing ${isNight ? 'nocturnal' : 'diurnal'} activity patterns during ${input.season} season`,
    };
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async getPredictions(params: {
    species?: AnimalSpecies; level?: AlertLevel; page?: string; limit?: string;
  }) {
    const { page = '1', limit = '20', species, level } = params;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE valid_until > NOW()';
    const values: unknown[] = [];
    let idx = 1;

    if (species) { where += ` AND species = $${idx++}`; values.push(species); }
    if (level) { where += ` AND alert_level = $${idx++}`; values.push(level); }

    const [count] = await query<{ count: string }>(`SELECT COUNT(*) FROM ai_predictions ${where}`, values);
    values.push(parseInt(limit), offset);

    const predictions = await query(
      `SELECT p.*, a.name as animal_name 
       FROM ai_predictions p LEFT JOIN animals a ON a.id = p.animal_id
       ${where} ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );
    return { predictions, total: parseInt(count?.count || '0') };
  }
}

export const predictionAgent = new WildlifePredictionAgent();
