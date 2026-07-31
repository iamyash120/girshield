import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { z, ZodSchema } from 'zod';
import { sendBadRequest } from '../utils/response';

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => e.msg).join(', ');
    sendBadRequest(res, messages);
    return;
  }
  next();
};

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      sendBadRequest(res, messages);
      return;
    }
    req.body = result.data;
    next();
  };
};

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const messages = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      sendBadRequest(res, messages);
      return;
    }
    req.query = result.data as Record<string, string>;
    next();
  };
};

// Common Zod schemas
export const paginationSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const uuidSchema = z.string().uuid('Invalid ID format');
