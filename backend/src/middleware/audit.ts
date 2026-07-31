import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { query } from '../config/database';
import { logger } from '../utils/logger';

export const auditLog = (action: string, resourceType: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const resourceId = req.params.id;
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.userId || null,
          action,
          resourceType,
          resourceId || null,
          req.ip,
          req.headers['user-agent'] || null,
        ]
      );
    } catch (err) {
      logger.error('Audit log failed', { error: (err as Error).message });
    }
    next();
  };
};

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
};
