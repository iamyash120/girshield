import { query } from '../config/database';
import { Village, AlertLevel } from '../types';
import { getPagination, buildPagination } from '../utils/response';

export class VillageRepository {
  async findAll(page = '1', limit = '20', search?: string, riskLevel?: AlertLevel) {
    const { page: p, limit: l, offset } = getPagination(page, limit);
    let whereClause = 'WHERE v.is_active = TRUE';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (v.name ILIKE $${paramIdx} OR v.taluka ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (riskLevel) {
      whereClause += ` AND v.risk_level = $${paramIdx}`;
      params.push(riskLevel);
      paramIdx++;
    }

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) FROM villages v ${whereClause}`,
      params
    );
    const total = parseInt(countRes[0]?.count || '0');

    params.push(l, offset);
    const villages = await query<Village>(
      `SELECT v.*, 
              (SELECT COUNT(*) FROM incidents i WHERE i.village_id = v.id AND i.status != 'closed') as active_incidents,
              (SELECT COUNT(*) FROM alerts a WHERE a.village_id = v.id AND a.is_active = TRUE) as active_alerts
       FROM villages v ${whereClause}
       ORDER BY v.risk_level DESC, v.name ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    return { villages, pagination: buildPagination(p, l, total) };
  }

  async findById(id: string): Promise<Village | null> {
    const [village] = await query<Village>(
      `SELECT v.*, 
              (SELECT COUNT(*) FROM users u WHERE u.village_id = v.id AND u.role = 'villager') as villager_count,
              (SELECT COUNT(*) FROM incidents i WHERE i.village_id = v.id) as total_incidents
       FROM villages v WHERE v.id = $1`,
      [id]
    );
    return village || null;
  }

  async create(data: Partial<Village>): Promise<Village> {
    const [village] = await query<Village>(
      `INSERT INTO villages (name, taluka, district, latitude, longitude, population, households, buffer_zone_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.name, data.taluka, data.district, data.latitude, data.longitude,
       data.population || 0, data.households || 0, data.buffer_zone_km || 5.0]
    );
    return village;
  }

  async update(id: string, data: Partial<Village>): Promise<Village | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.risk_level !== undefined) { fields.push(`risk_level = $${idx++}`); values.push(data.risk_level); }
    if (data.buffer_zone_km !== undefined) { fields.push(`buffer_zone_km = $${idx++}`); values.push(data.buffer_zone_km); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

    if (fields.length === 0) return null;
    values.push(id);

    const [village] = await query<Village>(
      `UPDATE villages SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return village || null;
  }

  async getHighRiskVillages(): Promise<Village[]> {
    return query<Village>(
      `SELECT v.*, 
              (SELECT COUNT(*) FROM incidents i WHERE i.village_id = v.id AND i.status != 'closed') as active_incidents
       FROM villages v 
       WHERE v.risk_level IN ('high', 'critical') AND v.is_active = TRUE
       ORDER BY v.risk_level DESC`
    );
  }

  async getNearbyVillages(lat: number, lng: number, radiusKm: number): Promise<Village[]> {
    return query<Village>(
      `SELECT *, 
              (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) AS distance_km
       FROM villages 
       WHERE is_active = TRUE
       HAVING (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) < $3
       ORDER BY distance_km ASC`,
      [lat, lng, radiusKm]
    );
  }
}

export const villageRepository = new VillageRepository();
