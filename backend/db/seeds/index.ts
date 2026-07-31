import 'dotenv/config';
import { pool } from '../src/config/database';
import { logger } from '../src/utils/logger';
import bcrypt from 'bcryptjs';

const seedData = async () => {
  const client = await pool.connect();
  try {
    logger.info('Starting seed data insertion...');

    // Villages around Gir Forest
    const villages = [
      { name: 'Sasan Gir', taluka: 'Talala', lat: 21.1241, lng: 70.5947, risk: 'critical', pop: 2850, km: 0.5 },
      { name: 'Dhari', taluka: 'Dhari', lat: 21.3333, lng: 71.0167, risk: 'high', pop: 12000, km: 8 },
      { name: 'Kodinar', taluka: 'Kodinar', lat: 20.7940, lng: 70.7017, risk: 'high', pop: 16000, km: 12 },
      { name: 'Una', taluka: 'Una', lat: 20.8240, lng: 71.0387, risk: 'medium', pop: 25000, km: 15 },
      { name: 'Veraval', taluka: 'Veraval', lat: 20.9056, lng: 70.3677, risk: 'medium', pop: 65000, km: 18 },
      { name: 'Mendarda', taluka: 'Mendarda', lat: 21.3100, lng: 70.4300, risk: 'high', pop: 4200, km: 3 },
      { name: 'Visavadar', taluka: 'Visavadar', lat: 21.3528, lng: 70.7133, risk: 'critical', pop: 5100, km: 1.2 },
      { name: 'Khamba', taluka: 'Khamba', lat: 21.0700, lng: 71.2300, risk: 'low', pop: 8500, km: 20 },
      { name: 'Talala', taluka: 'Talala', lat: 21.0330, lng: 70.4667, risk: 'critical', pop: 3200, km: 2 },
      { name: 'Rajula', taluka: 'Rajula', lat: 21.0464, lng: 71.4458, risk: 'low', pop: 22000, km: 25 },
    ];

    const villageIds: string[] = [];
    for (const v of villages) {
      const [row] = await client.query(
        `INSERT INTO villages (name, taluka, latitude, longitude, risk_level, population, households, nearest_forest_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         ON CONFLICT DO NOTHING RETURNING id`,
        [v.name, v.taluka, v.lat, v.lng, v.risk, v.pop, Math.floor(v.pop / 5), v.km]
      );
      if (row?.id) villageIds.push(row.id);
    }
    logger.info(`Inserted ${villageIds.length} villages`);

    // Animals
    const animals = [
      { name: 'Kesar', species: 'asiatic_lion', gender: 'male', age: 8, collar: 'GL-001', gps: true, lat: 21.1300, lng: 70.5900 },
      { name: 'Durga', species: 'asiatic_lion', gender: 'female', age: 6, collar: 'GL-002', gps: true, lat: 21.1150, lng: 70.5700 },
      { name: 'Sher Khan', species: 'asiatic_lion', gender: 'male', age: 10, collar: 'GL-003', gps: true, lat: 21.1500, lng: 70.6100 },
      { name: 'Leopard Alpha', species: 'leopard', gender: 'male', age: 5, collar: 'LP-001', gps: true, lat: 21.2100, lng: 70.6500 },
      { name: 'Leopard Beta', species: 'leopard', gender: 'female', age: 4, collar: 'LP-002', gps: false, lat: 21.1800, lng: 70.5800 },
      { name: 'Spotted One', species: 'leopard', gender: 'unknown', age: 3, collar: null, gps: false, lat: 21.3000, lng: 70.7000 },
    ];

    const animalIds: string[] = [];
    for (const a of animals) {
      const [row] = await client.query(
        `INSERT INTO animals (name, species, gender, age_estimate_years, collar_id, is_gps_tagged, last_known_latitude, last_known_longitude, last_seen_at, health_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'healthy')
         ON CONFLICT DO NOTHING RETURNING id`,
        [a.name, a.species, a.gender, a.age, a.collar, a.gps, a.lat, a.lng]
      );
      if (row?.id) animalIds.push(row.id);
    }
    logger.info(`Inserted ${animalIds.length} animals`);

    // Users
    const passwordHash = await bcrypt.hash('GirShield@2024', 12);
    const users = [
      { name: 'Admin GirShield', email: 'admin@girshield.ai', phone: '9876543210', role: 'admin', village: null },
      { name: 'Ranger Mahesh Solanki', email: 'mahesh.officer@girshield.ai', phone: '9876543211', role: 'forest_officer', village: null },
      { name: 'Ranger Priya Patel', email: 'priya.officer@girshield.ai', phone: '9876543212', role: 'forest_officer', village: null },
      { name: 'Ramesh Bhai Ahir', email: 'ramesh@sasan.in', phone: '9876543213', role: 'villager', village: 0 },
      { name: 'Meena Ben Parmar', email: 'meena@sasan.in', phone: '9876543214', role: 'villager', village: 0 },
      { name: 'Jayesh Vadher', email: 'jayesh@talala.in', phone: '9876543215', role: 'villager', village: 8 },
    ];

    const userIds: string[] = [];
    for (const u of users) {
      const villageId = u.village !== null && villageIds[u.village] ? villageIds[u.village] : null;
      const [row] = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, village_id, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (email) DO NOTHING RETURNING id`,
        [u.name, u.email, u.phone, passwordHash, u.role, villageId]
      );
      if (row?.id) userIds.push(row.id);
    }
    logger.info(`Inserted ${userIds.length} users`);

    // Create forest officer profiles
    const officerIds = userIds.filter((_, i) => users[i]?.role === 'forest_officer');
    for (let i = 0; i < officerIds.length; i++) {
      await client.query(
        `INSERT INTO forest_officers (user_id, officer_id, designation, zone, division) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [officerIds[i], `FO-GIR-${2024 + i}`, 'Range Forest Officer', 'Gir East', 'Junagadh Division']
      );
    }

    // Record animal movements
    if (animalIds.length > 0 && villageIds.length > 0) {
      const now = new Date();
      for (let i = 0; i < Math.min(animalIds.length, 3); i++) {
        const animalId = animalIds[i];
        const baseLat = 21.13 + (i * 0.05);
        const baseLng = 70.59 + (i * 0.03);
        for (let j = 0; j < 10; j++) {
          const ts = new Date(now.getTime() - j * 3600000);
          await client.query(
            `INSERT INTO animal_movements (animal_id, latitude, longitude, recorded_at, source, confidence) VALUES ($1, $2, $3, $4, 'gps_collar', 0.95)`,
            [animalId, baseLat + (j * 0.002), baseLng + (j * 0.001), ts]
          );
        }
      }
    }

    // Insert sample incidents and alerts
    if (userIds.length > 3 && villageIds.length > 0) {
      const [incidentRow] = await client.query(
        `INSERT INTO incidents (village_id, reported_by, type, title, description, latitude, longitude, severity, status, occurred_at)
         VALUES ($1, $2, 'livestock_attack', 'Lion attacked cattle near Sasan', 'A pride of lions attacked and killed 2 cattle near the village boundary late at night.', 21.1241, 70.5947, 'high', 'reported', NOW() - INTERVAL '2 hours')
         RETURNING id`,
        [villageIds[0], userIds[3]]
      );

      if (incidentRow?.id && userIds[0]) {
        await client.query(
          `INSERT INTO alerts (animal_id, village_id, level, title, message, latitude, longitude, radius_km, expires_at, created_by)
           VALUES ($1, $2, 'high', 'Lion Sighting Alert - Sasan Gir', 'A lion has been spotted near village boundary. Keep livestock secured and stay indoors after dark.', 21.1241, 70.5947, 5.0, NOW() + INTERVAL '12 hours', $3)`,
          [animalIds[0] || null, villageIds[0], userIds[0]]
        );
      }
    }

    // System config
    await client.query(
      `INSERT INTO system_config (key, value, description) VALUES
       ('prediction_interval_hours', '6', 'How often to run AI predictions'),
       ('alert_radius_km_critical', '8', 'Alert radius for critical threats'),
       ('alert_radius_km_high', '5', 'Alert radius for high threats'),
       ('compensation_auto_verify', 'false', 'Auto-verify small compensation claims')
       ON CONFLICT (key) DO NOTHING`
    );

    logger.info('✅ Seed data insertion complete!');
    logger.info('📧 Test credentials: admin@girshield.ai / GirShield@2024');
  } catch (err) {
    logger.error('Seed failed', { error: (err as Error).message });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seedData().catch(() => process.exit(1));
