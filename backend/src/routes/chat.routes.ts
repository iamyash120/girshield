import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendBadRequest } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { graniteService } from '../agents/granite.service';
import { notificationService } from '../services/notification.service';
import { query } from '../config/database';
import { z } from 'zod';

const router = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
  context: z.record(z.unknown()).optional().default({}),
});

// POST /api/chat - AI chat endpoint
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { message, history, context } = chatSchema.parse(req.body);
  
  // Build context from user role
  const user = req.user!;
  let enrichedContext = { ...context, userRole: user.role, userId: user.userId };
  
  // Get recent alerts/incidents for context
  if (user.role === 'villager') {
    const [userData] = await query<{ village_id: string }>(
      'SELECT village_id FROM users WHERE id = $1', [user.userId]
    );
    if (userData?.village_id) {
      enrichedContext = { ...enrichedContext, villageId: userData.village_id };
    }
  }

  // Process NL query to detect intent
  const nlResult = await graniteService.processNaturalLanguageQuery(message, enrichedContext);
  
  const messages = [
    ...history,
    { role: 'user' as const, content: message },
  ];
  
  let response: string;
  
  // Handle specific intents
  if (nlResult.intent === 'generate_report' && user.role !== 'villager') {
    const stats = await getSystemStats();
    response = await graniteService.generateWeeklyReport(stats);
  } else if (nlResult.intent === 'safety_guidance') {
    response = await graniteService.generateSafetyGuidance('asiatic_lion', 2);
  } else if (nlResult.intent === 'compensation_help') {
    response = await graniteService.generateCompensationGuidance('livestock attack', 'cattle');
  } else {
    response = await graniteService.chat(messages);
  }

  sendSuccess(res, { 
    message: response, 
    intent: nlResult.intent,
    suggestions: getSuggestions(user.role),
  }, 'Chat response');
}));

// GET /api/chat/safety/:species
router.get('/safety/:species', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { species } = req.params;
  const { distance } = req.query;
  const guidance = await graniteService.generateSafetyGuidance(
    species as any, parseFloat(distance as string || '2')
  );
  sendSuccess(res, { guidance }, 'Safety guidance generated');
}));

// GET /api/chat/compensation-guide
router.get('/compensation-guide', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, livestock } = req.query;
  const guidance = await graniteService.generateCompensationGuidance(
    type as string || 'livestock attack', livestock as string
  );
  sendSuccess(res, { guidance }, 'Compensation guide generated');
}));

// GET /api/chat/notifications
router.get('/notifications', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, unreadOnly } = req.query;
  const result = await notificationService.getUserNotifications(
    req.user!.userId, parseInt(page as string || '1'), 20, unreadOnly === 'true'
  );
  const unreadCount = await notificationService.getUnreadCount(req.user!.userId);
  sendSuccess(res, { ...result, unreadCount }, 'Notifications retrieved');
}));

router.patch('/notifications/:id/read', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationService.markAsRead(req.params.id, req.user!.userId);
  sendSuccess(res, null, 'Notification marked as read');
}));

router.patch('/notifications/read-all', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationService.markAllAsRead(req.user!.userId);
  sendSuccess(res, null, 'All notifications marked as read');
}));

async function getSystemStats(): Promise<Record<string, unknown>> {
  const [stats] = await query(
    `SELECT 
      (SELECT COUNT(*) FROM incidents WHERE occurred_at >= NOW() - INTERVAL '7 days') as weekly_incidents,
      (SELECT COUNT(*) FROM alerts WHERE is_active = TRUE) as active_alerts,
      (SELECT COUNT(*) FROM animals WHERE is_active = TRUE) as tracked_animals,
      (SELECT COUNT(*) FROM villages WHERE is_active = TRUE) as total_villages`
  );
  return stats || {};
}

function getSuggestions(role: string): string[] {
  if (role === 'villager') {
    return [
      'Show active alerts near my village',
      'How do I file a compensation claim?',
      'What should I do if I see a lion?',
      'Check status of my compensation',
    ];
  }
  if (role === 'forest_officer') {
    return [
      'Show unassigned incidents',
      'Predict lion movement for tonight',
      'Generate patrol route for my zone',
      'Show active rescue missions',
    ];
  }
  return [
    'Show weekly incident statistics',
    'Generate report for this month',
    'Which villages have highest conflict?',
    'Show all active AI predictions',
  ];
}

export default router;
