import { query } from '../config/database';
import { Alert, AlertLevel } from '../types';
import { buildPagination, getPagination } from '../utils/response';

export class AlertRepository {
  async findAll(page = '1', limit = '20', villageId?: string, level?: AlertLevel, isActive?: boolean) {
    const { page: p, limit: l, offset } = getPagination(page, limit);
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (villageId) { where += ` AND a.village_id = $${idx++}`; params.push(villageId); }
    if (level) { where += ` AND a.level = $${idx++}`; params.push(level); }
    if (isActive !== undefined) { where += ` AND a.is_active = $${idx++}`; params.push(isActive); }

    const [count] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM alerts a ${where}`, params
    );
    params.push(l, offset);

    const alerts = await query<Alert & { animal_name?: string; village_name?: string }>(
      `SELECT a.*, an.name as animal_name, an.species as animal_species, v.name as village_name
       FROM alerts a
       LEFT JOIN animals an ON an.id = a.animal_id
       LEFT JOIN villages v ON v.id = a.village_id
       ${where} ORDER BY a.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return { alerts, pagination: buildPagination(p, l, parseInt(count?.count || '0')) };
  }

  async findById(id: string) {
    const [alert] = await query<Alert & { animal_name?: string; village_name?: string }>(
      `SELECT a.*, an.name as animal_name, an.species as animal_species, v.name as village_name
       FROM alerts a
       LEFT JOIN animals an ON an.id = a.animal_id
       LEFT JOIN villages v ON v.id = a.village_id
       WHERE a.id = $1`,
      [id]
    );
    return alert || null;
  }

  async create(data: Partial<Alert>): Promise<Alert> {
    const [alert] = await query<Alert>(
      `INSERT INTO alerts (animal_id, village_id, level, title, message, latitude, longitude, radius_km, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.animal_id, data.village_id, data.level || 'medium', data.title, data.message,
       data.latitude, data.longitude, data.radius_km || 5.0, data.expires_at, data.created_by]
    );
    return alert;
  }

  async deactivate(id: string): Promise<void> {
    await query('UPDATE alerts SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
  }

  async getActiveAlertsForVillage(villageId: string): Promise<Alert[]> {
    return query<Alert>(
      `SELECT a.*, an.name as animal_name, an.species as animal_species
       FROM alerts a LEFT JOIN animals an ON an.id = a.animal_id
       WHERE a.village_id = $1 AND a.is_active = TRUE AND (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY a.level DESC, a.created_at DESC`,
      [villageId]
    );
  }

  async getActiveCriticalAlerts(): Promise<Alert[]> {
    return query<Alert>(
      `SELECT a.*, v.name as village_name, an.name as animal_name
       FROM alerts a
       LEFT JOIN villages v ON v.id = a.village_id
       LEFT JOIN animals an ON an.id = a.animal_id
       WHERE a.is_active = TRUE AND a.level IN ('critical', 'high')
       ORDER BY a.created_at DESC LIMIT 50`
    );
  }

  async incrementAcknowledged(id: string): Promise<void> {
    await query('UPDATE alerts SET acknowledged_count = acknowledged_count + 1 WHERE id = $1', [id]);
  }
}

export const alertRepository = new AlertRepository();
