import { query } from '../config/database';
import { Animal, AnimalMovement, AnimalSpecies } from '../types';
import { buildPagination, getPagination } from '../utils/response';

export class AnimalRepository {
  async findAll(page = '1', limit = '20', species?: AnimalSpecies, isGpsTagged?: boolean) {
    const { page: p, limit: l, offset } = getPagination(page, limit);
    let where = 'WHERE a.is_active = TRUE';
    const params: unknown[] = [];
    let idx = 1;

    if (species) { where += ` AND a.species = $${idx++}`; params.push(species); }
    if (isGpsTagged !== undefined) { where += ` AND a.is_gps_tagged = $${idx++}`; params.push(isGpsTagged); }

    const [count] = await query<{ count: string }>(`SELECT COUNT(*) FROM animals a ${where}`, params);
    params.push(l, offset);

    const animals = await query<Animal>(
      `SELECT * FROM animals a ${where} ORDER BY a.last_seen_at DESC NULLS LAST LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return { animals, pagination: buildPagination(p, l, parseInt(count?.count || '0')) };
  }

  async findById(id: string): Promise<Animal | null> {
    const [animal] = await query<Animal>('SELECT * FROM animals WHERE id = $1', [id]);
    return animal || null;
  }

  async create(data: Partial<Animal>): Promise<Animal> {
    const [animal] = await query<Animal>(
      `INSERT INTO animals (name, species, gender, age_estimate_years, collar_id, is_gps_tagged, health_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.name, data.species, data.gender || 'unknown', data.age_estimate_years,
       data.collar_id, data.is_gps_tagged || false, data.health_status || 'unknown', data.notes]
    );
    return animal;
  }

  async update(id: string, data: Partial<Animal>): Promise<Animal | null> {
    const [animal] = await query<Animal>(
      `UPDATE animals SET 
        name = COALESCE($1, name),
        last_known_latitude = COALESCE($2, last_known_latitude),
        last_known_longitude = COALESCE($3, last_known_longitude),
        last_seen_at = COALESCE($4, last_seen_at),
        health_status = COALESCE($5, health_status),
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [data.name, data.last_known_latitude, data.last_known_longitude,
       data.last_seen_at, data.health_status, id]
    );
    return animal || null;
  }

  async recordMovement(data: Partial<AnimalMovement>): Promise<AnimalMovement> {
    const [movement] = await query<AnimalMovement>(
      `INSERT INTO animal_movements (animal_id, latitude, longitude, altitude, speed_kmph, heading_degrees, recorded_at, source, confidence, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.animal_id, data.latitude, data.longitude, data.altitude,
       data.speed_kmph, data.heading_degrees, data.recorded_at || new Date(),
       data.source || 'field_observation', data.confidence, data.notes]
    );
    // Update animal's last known location
    await query(
      'UPDATE animals SET last_known_latitude = $1, last_known_longitude = $2, last_seen_at = $3, updated_at = NOW() WHERE id = $4',
      [data.latitude, data.longitude, data.recorded_at || new Date(), data.animal_id]
    );
    return movement;
  }

  async getMovementHistory(animalId: string, days = 7): Promise<AnimalMovement[]> {
    return query<AnimalMovement>(
      `SELECT * FROM animal_movements 
       WHERE animal_id = $1 AND recorded_at >= NOW() - INTERVAL '${days} days'
       ORDER BY recorded_at DESC`,
      [animalId]
    );
  }

  async getRecentSightings(hours = 24): Promise<(Animal & { latitude: number; longitude: number; recorded_at: Date })[]> {
    return query(
      `SELECT a.id, a.name, a.species, am.latitude, am.longitude, am.recorded_at
       FROM animals a
       JOIN animal_movements am ON am.animal_id = a.id
       WHERE am.recorded_at >= NOW() - INTERVAL '${hours} hours'
       ORDER BY am.recorded_at DESC`,
      []
    );
  }
}

export const animalRepository = new AnimalRepository();
