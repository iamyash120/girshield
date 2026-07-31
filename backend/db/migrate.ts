import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/database';
import { logger } from '../src/utils/logger';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR = path.join(__dirname, 'seeds');

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const result = await client.query(
        'SELECT id FROM schema_migrations WHERE filename = $1',
        [file]
      );
      if (result.rows.length === 0) {
        logger.info(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
          logger.info(`Migration ${file} completed`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      } else {
        logger.info(`Migration ${file} already applied`);
      }
    }

    logger.info('All migrations completed');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  logger.error('Migration failed', { error: err.message });
  process.exit(1);
});
