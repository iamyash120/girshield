import { query } from '../config/database';
import { alertRepository } from '../repositories/alert.repository';
import { Alert, AlertLevel, AnimalSpecies } from '../types';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';

interface AlertContext {
  predictionId?: string;
  species: AnimalSpecies;
  threatScore: number;
  alertLevel: AlertLevel;
  predictedLat: number;
  predictedLng: number;
  affectedVillageIds: string[];
  animalId?: string;
  animalName?: string;
}

export class VillageAlertAgent {
  name = 'VillageAlertAgent';

  async processAndBroadcast(context: AlertContext): Promise<Alert[]> {
    logger.info('VillageAlertAgent: Processing alert broadcast', { context });

    const createdAlerts: Alert[] = [];

    for (const villageId of context.affectedVillageIds) {
      // Get village details
      const [village] = await query<{ id: string; name: string; risk_level: string }>(
        'SELECT id, name, risk_level FROM villages WHERE id = $1',
        [villageId]
      );
      if (!village) continue;

      const title = this.generateAlertTitle(context.species, context.alertLevel);
      const message = this.generateAlertMessage(context, village.name);
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      // Create alert record — use system user ID or first admin
      const [systemUser] = await query<{ id: string }>(
        "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1"
      );

      const alert = await alertRepository.create({
        animal_id: context.animalId,
        village_id: villageId,
        level: context.alertLevel,
        title,
        message,
        latitude: context.predictedLat,
        longitude: context.predictedLng,
        radius_km: context.alertLevel === 'critical' ? 8 : context.alertLevel === 'high' ? 5 : 3,
        expires_at: expiresAt,
        created_by: systemUser?.id,
      });

      createdAlerts.push(alert);

      // Send notifications to villagers in this village
      await this.notifyVillagers(villageId, alert, context.species, context.alertLevel);
    }

    logger.info(`VillageAlertAgent: Created ${createdAlerts.length} alerts`);
    return createdAlerts;
  }

  private async notifyVillagers(
    villageId: string,
    alert: Alert,
    species: AnimalSpecies,
    level: AlertLevel
  ): Promise<void> {
    const villagers = await query<{ id: string; name: string; phone: string }>(
      "SELECT id, name, phone FROM users WHERE village_id = $1 AND role = 'villager' AND is_active = TRUE",
      [villageId]
    );

    for (const villager of villagers) {
      await notificationService.createNotification({
        userId: villager.id,
        type: 'alert',
        title: alert.title,
        body: alert.message,
        data: { alertId: alert.id, level, species },
      });
    }
  }

  private generateAlertTitle(species: AnimalSpecies, level: AlertLevel): string {
    const speciesMap = {
      asiatic_lion: '🦁 Asiatic Lion',
      leopard: '🐆 Leopard',
      hyena: 'Hyena',
      wolf: 'Wolf',
      other: 'Wildlife',
    };
    const levelMap = {
      critical: 'CRITICAL ALERT',
      high: 'HIGH ALERT',
      medium: 'ALERT',
      low: 'ADVISORY',
    };
    return `${levelMap[level]}: ${speciesMap[species] || 'Wildlife'} Sighting Nearby`;
  }

  private generateAlertMessage(context: AlertContext, villageName: string): string {
    const speciesMap = {
      asiatic_lion: 'an Asiatic Lion',
      leopard: 'a Leopard',
      hyena: 'a Hyena',
      wolf: 'a Wolf',
      other: 'wildlife',
    };
    const animal = speciesMap[context.species] || 'wildlife';
    const confidence = Math.round(context.threatScore * 100);

    const safetyTips: Record<AlertLevel, string> = {
      critical: 'STAY INDOORS. Do not go outside. Keep all livestock secured. Call forest department immediately: 1800-180-6127.',
      high: 'Avoid open areas. Secure livestock. Stay in groups if outdoors. Alert neighbors.',
      medium: 'Exercise caution. Keep children and livestock indoors. Report any sightings to forest department.',
      low: 'Stay alert. Avoid forest edge areas after dark. Report unusual wildlife activity.',
    };

    return `Movement of ${animal} detected near ${villageName}. Threat level: ${confidence}% probability. ${safetyTips[context.alertLevel]}`;
  }

  async getAlertSummary(villageId: string): Promise<{
    activeCount: number; criticalCount: number; lastAlert?: Date;
  }> {
    const [stats] = await query<{ active: string; critical: string; last_alert: Date }>(
      `SELECT 
        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
        COUNT(*) FILTER (WHERE is_active = TRUE AND level = 'critical') as critical,
        MAX(created_at) as last_alert
       FROM alerts WHERE village_id = $1`,
      [villageId]
    );
    return {
      activeCount: parseInt(stats?.active || '0'),
      criticalCount: parseInt(stats?.critical || '0'),
      lastAlert: stats?.last_alert,
    };
  }
}

export const alertAgent = new VillageAlertAgent();
