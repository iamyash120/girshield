import { query } from '../config/database';
import { Incident, IncidentStatus, AlertLevel } from '../types';
import { buildPagination, getPagination } from '../utils/response';

export class IncidentRepository {
  async findAll(params: {
    page?: string; limit?: string; villageId?: string;
    status?: IncidentStatus; officerId?: string; reportedBy?: string;
    severity?: AlertLevel;
  }) {
    const { page: p, limit: l, offset } = getPagination(params.page, params.limit);
    let where = 'WHERE 1=1';
    const values: unknown[] = [];
    let idx = 1;

    if (params.villageId) { where += ` AND i.village_id = $${idx++}`; values.push(params.villageId); }
    if (params.status) { where += ` AND i.status = $${idx++}`; values.push(params.status); }
    if (params.officerId) { where += ` AND i.assigned_officer_id = $${idx++}`; values.push(params.officerId); }
    if (params.reportedBy) { where += ` AND i.reported_by = $${idx++}`; values.push(params.reportedBy); }
    if (params.severity) { where += ` AND i.severity = $${idx++}`; values.push(params.severity); }

    const [count] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM incidents i ${where}`, values
    );
    values.push(l, offset);

    const incidents = await query<Incident & { village_name: string; reporter_name: string; officer_name?: string }>(
      `SELECT i.*, v.name as village_name, u.name as reporter_name, 
              o.name as officer_name, a.name as animal_name, a.species as animal_species
       FROM incidents i
       LEFT JOIN villages v ON v.id = i.village_id
       LEFT JOIN users u ON u.id = i.reported_by
       LEFT JOIN users o ON o.id = i.assigned_officer_id
       LEFT JOIN animals a ON a.id = i.animal_id
       ${where} ORDER BY i.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );
    return { incidents, pagination: buildPagination(p, l, parseInt(count?.count || '0')) };
  }

  async findById(id: string) {
    const [incident] = await query(
      `SELECT i.*, v.name as village_name, v.latitude as village_lat, v.longitude as village_lng,
              u.name as reporter_name, u.phone as reporter_phone,
              o.name as officer_name, a.name as animal_name, a.species,
              rm.id as mission_id, rm.status as mission_status, rm.eta_minutes
       FROM incidents i
       LEFT JOIN villages v ON v.id = i.village_id
       LEFT JOIN users u ON u.id = i.reported_by
       LEFT JOIN users o ON o.id = i.assigned_officer_id
       LEFT JOIN animals a ON a.id = i.animal_id
       LEFT JOIN rescue_missions rm ON rm.id = i.rescue_mission_id
       WHERE i.id = $1`,
      [id]
    );
    return incident || null;
  }

  async create(data: Partial<Incident> & { created_by?: string }): Promise<Incident> {
    const [incident] = await query<Incident>(
      `INSERT INTO incidents (village_id, reported_by, animal_id, type, title, description, latitude, longitude, photos, severity, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [data.village_id, data.reported_by, data.animal_id, data.type, data.title,
       data.description, data.latitude, data.longitude, data.photos || '{}',
       data.severity || 'medium', data.occurred_at || new Date()]
    );
    return incident;
  }

  async updateStatus(id: string, status: IncidentStatus, officerId?: string, notes?: string): Promise<Incident | null> {
    const [incident] = await query<Incident>(
      `UPDATE incidents SET 
        status = $1,
        assigned_officer_id = COALESCE($2, assigned_officer_id),
        resolution_notes = COALESCE($3, resolution_notes),
        resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, officerId, notes, id]
    );
    return incident || null;
  }

  async getStats(villageId?: string): Promise<Record<string, number>> {
    const where = villageId ? `WHERE village_id = '${villageId}'` : '';
    const rows = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM incidents ${where} GROUP BY status`
    );
    const stats: Record<string, number> = {};
    rows.forEach(r => { stats[r.status] = parseInt(r.count); });
    return stats;
  }

  async getMonthlyTrends(months = 6): Promise<{ month: string; count: number; severity: string }[]> {
    return query(
      `SELECT 
        TO_CHAR(date_trunc('month', occurred_at), 'YYYY-MM') as month,
        COUNT(*) as count,
        severity
       FROM incidents
       WHERE occurred_at >= NOW() - INTERVAL '${months} months'
       GROUP BY month, severity
       ORDER BY month ASC`
    );
  }
}

export const incidentRepository = new IncidentRepository();
