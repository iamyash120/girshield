import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { z } from 'zod';

const router = Router();

const createClaimSchema = z.object({
  incident_id: z.string().uuid(),
  type: z.enum(['livestock', 'property', 'crop', 'medical', 'death']),
  claimed_amount: z.number().positive(),
  description: z.string().min(20),
  evidence_urls: z.array(z.string()).optional().default([]),
  livestock_details: z.record(z.unknown()).optional(),
});

// GET /api/compensation - List claims
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20', status } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  let idx = 1;
  
  if (req.user!.role === 'villager') {
    where += ` AND cc.applicant_id = $${idx++}`;
    params.push(req.user!.userId);
  }
  if (status) { where += ` AND cc.status = $${idx++}`; params.push(status); }
  
  const [count] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM compensation_claims cc ${where}`, params
  );
  params.push(parseInt(limit), offset);
  
  const claims = await query(
    `SELECT cc.*, i.title as incident_title, i.type as incident_type,
            v.name as village_name, u.name as applicant_name
     FROM compensation_claims cc
     JOIN incidents i ON i.id = cc.incident_id
     JOIN villages v ON v.id = cc.village_id
     JOIN users u ON u.id = cc.applicant_id
     ${where} ORDER BY cc.submitted_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );
  
  sendSuccess(res, claims, 'Compensation claims retrieved', 200, {
    page: parseInt(page), limit: parseInt(limit),
    total: parseInt(count?.count || '0'),
    totalPages: Math.ceil(parseInt(count?.count || '0') / parseInt(limit))
  });
}));

// GET /api/compensation/:id
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const [claim] = await query(
    `SELECT cc.*, i.title as incident_title, i.type as incident_type,
            v.name as village_name, u.name as applicant_name, u.phone as applicant_phone,
            r.name as reviewer_name
     FROM compensation_claims cc
     JOIN incidents i ON i.id = cc.incident_id
     JOIN villages v ON v.id = cc.village_id
     JOIN users u ON u.id = cc.applicant_id
     LEFT JOIN users r ON r.id = cc.reviewer_id
     WHERE cc.id = $1`,
    [req.params.id]
  );
  if (!claim) return sendNotFound(res, 'Claim not found');
  sendSuccess(res, claim, 'Claim retrieved');
}));

// POST /api/compensation - Submit claim
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createClaimSchema.parse(req.body);
  
  const [incident] = await query<{ village_id: string }>(
    'SELECT village_id FROM incidents WHERE id = $1', [data.incident_id]
  );
  if (!incident) return sendNotFound(res, 'Incident not found');
  
  const [claim] = await query(
    `INSERT INTO compensation_claims (incident_id, applicant_id, village_id, type, claimed_amount, description, evidence_urls, livestock_details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [data.incident_id, req.user!.userId, incident.village_id, data.type,
     data.claimed_amount, data.description, data.evidence_urls, JSON.stringify(data.livestock_details || {})]
  );
  
  sendCreated(res, claim, 'Compensation claim submitted');
}));

// PATCH /api/compensation/:id/review - Admin/officer review
router.patch('/:id/review', authenticate, authorize('admin', 'super_admin', 'forest_officer'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    status: z.enum(['approved', 'rejected', 'under_review']),
    approved_amount: z.number().optional(),
    review_notes: z.string().optional(),
  });
  
  const { status, approved_amount, review_notes } = schema.parse(req.body);
  
  const [claim] = await query(
    `UPDATE compensation_claims SET 
      status = $1, approved_amount = $2, review_notes = $3,
      reviewer_id = $4, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [status, approved_amount, review_notes, req.user!.userId, req.params.id]
  );
  
  if (!claim) return sendNotFound(res, 'Claim not found');
  sendSuccess(res, claim, 'Claim reviewed');
}));

export default router;
