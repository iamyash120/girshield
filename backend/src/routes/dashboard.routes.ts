import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendNotFound } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { z } from 'zod';

const router = Router();

// GET /api/dashboard/villager
router.get('/villager', authenticate, authorize('villager'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const [user] = await query<{ village_id: string; name: string }>(
    'SELECT village_id, name FROM users WHERE id = $1', [req.user!.userId]
  );
  if (!user?.village_id) return sendNotFound(res, 'Village not assigned');

  const villageId = user.village_id;

  const [stats] = await query(
    `SELECT 
      (SELECT COUNT(*) FROM alerts WHERE village_id = $1 AND is_active = TRUE) as active_alerts,
      (SELECT COUNT(*) FROM incidents WHERE village_id = $1 AND status != 'closed') as active_incidents,
      (SELECT COUNT(*) FROM compensation_claims cc JOIN incidents i ON i.id = cc.incident_id WHERE i.village_id = $1 AND cc.applicant_id = $2) as my_claims,
      (SELECT COUNT(*) FROM compensation_claims cc JOIN incidents i ON i.id = cc.incident_id WHERE i.village_id = $1 AND cc.applicant_id = $2 AND cc.status = 'approved') as approved_claims`,
    [villageId, req.user!.userId]
  );

  const recentAlerts = await query(
    `SELECT a.*, an.name as animal_name, an.species 
     FROM alerts a LEFT JOIN animals an ON an.id = a.animal_id
     WHERE a.village_id = $1 AND a.is_active = TRUE
     ORDER BY a.created_at DESC LIMIT 5`,
    [villageId]
  );

  const recentIncidents = await query(
    `SELECT i.*, u.name as reporter_name 
     FROM incidents i LEFT JOIN users u ON u.id = i.reported_by
     WHERE i.village_id = $1
     ORDER BY i.created_at DESC LIMIT 5`,
    [villageId]
  );

  const [villageInfo] = await query(
    'SELECT * FROM villages WHERE id = $1', [villageId]
  );

  sendSuccess(res, {
    user,
    village: villageInfo,
    stats,
    recentAlerts,
    recentIncidents,
  }, 'Villager dashboard data retrieved');
}));

// GET /api/dashboard/officer
router.get('/officer', authenticate, authorize('forest_officer'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const [officer] = await query(
    `SELECT fo.*, u.name, u.phone, u.email 
     FROM forest_officers fo JOIN users u ON u.id = fo.user_id
     WHERE fo.user_id = $1`,
    [req.user!.userId]
  );

  const [stats] = await query(
    `SELECT 
      (SELECT COUNT(*) FROM incidents WHERE assigned_officer_id = $1 AND status NOT IN ('resolved','closed')) as my_active_incidents,
      (SELECT COUNT(*) FROM incidents WHERE assigned_officer_id = $1) as total_assigned,
      (SELECT COUNT(*) FROM rescue_missions rm JOIN forest_officers fo ON fo.id = rm.lead_officer_id WHERE fo.user_id = $1 AND rm.status = 'active') as active_missions,
      (SELECT COUNT(*) FROM alerts WHERE is_active = TRUE AND level IN ('high','critical')) as critical_alerts`,
    [req.user!.userId]
  );

  const assignedIncidents = await query(
    `SELECT i.*, v.name as village_name, v.latitude, v.longitude
     FROM incidents i JOIN villages v ON v.id = i.village_id
     WHERE i.assigned_officer_id = $1 AND i.status NOT IN ('resolved','closed')
     ORDER BY i.severity DESC, i.created_at DESC LIMIT 10`,
    [req.user!.userId]
  );

  const activeMissions = await query(
    `SELECT rm.*, i.title as incident_title, v.name as village_name
     FROM rescue_missions rm 
     JOIN incidents i ON i.id = rm.incident_id
     JOIN villages v ON v.id = i.village_id
     JOIN forest_officers fo ON fo.id = rm.lead_officer_id
     WHERE fo.user_id = $1 AND rm.status IN ('pending','active')
     ORDER BY rm.created_at DESC LIMIT 5`,
    [req.user!.userId]
  );

  const recentPredictions = await query(
    `SELECT p.*, a.name as animal_name 
     FROM ai_predictions p LEFT JOIN animals a ON a.id = p.animal_id
     WHERE p.valid_until > NOW() AND p.alert_level IN ('high','critical')
     ORDER BY p.created_at DESC LIMIT 5`
  );

  sendSuccess(res, {
    officer,
    stats,
    assignedIncidents,
    activeMissions,
    recentPredictions,
  }, 'Officer dashboard data retrieved');
}));

// GET /api/dashboard/admin
router.get('/admin', authenticate, authorize('admin', 'super_admin'), asyncHandler(async (_req: Request, res: Response) => {
  const [systemStats] = await query(
    `SELECT 
      (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_users,
      (SELECT COUNT(*) FROM villages WHERE is_active = TRUE) as total_villages,
      (SELECT COUNT(*) FROM animals WHERE is_active = TRUE) as tracked_animals,
      (SELECT COUNT(*) FROM incidents) as total_incidents,
      (SELECT COUNT(*) FROM incidents WHERE status NOT IN ('resolved','closed')) as active_incidents,
      (SELECT COUNT(*) FROM alerts WHERE is_active = TRUE) as active_alerts,
      (SELECT COUNT(*) FROM compensation_claims) as total_claims,
      (SELECT COUNT(*) FROM compensation_claims WHERE status = 'pending') as pending_claims,
      (SELECT COUNT(*) FROM rescue_missions WHERE status = 'active') as active_missions,
      (SELECT COUNT(*) FROM ai_predictions WHERE valid_until > NOW()) as active_predictions`
  );

  const recentIncidents = await query(
    `SELECT i.*, v.name as village_name, u.name as reporter_name
     FROM incidents i 
     JOIN villages v ON v.id = i.village_id
     JOIN users u ON u.id = i.reported_by
     ORDER BY i.created_at DESC LIMIT 8`
  );

  const riskVillages = await query(
    `SELECT v.*, 
      COUNT(DISTINCT i.id) as incident_count,
      COUNT(DISTINCT a.id) as alert_count
     FROM villages v
     LEFT JOIN incidents i ON i.village_id = v.id AND i.status != 'closed'
     LEFT JOIN alerts a ON a.village_id = v.id AND a.is_active = TRUE
     WHERE v.is_active = TRUE
     GROUP BY v.id
     ORDER BY incident_count DESC, alert_count DESC LIMIT 10`
  );

  const speciesStats = await query(
    `SELECT species, COUNT(*) as sighting_count, MAX(recorded_at) as last_seen
     FROM animal_movements
     JOIN animals ON animals.id = animal_movements.animal_id
     WHERE recorded_at >= NOW() - INTERVAL '30 days'
     GROUP BY species ORDER BY sighting_count DESC`
  );

  const monthlyTrends = await query(
    `SELECT 
      TO_CHAR(date_trunc('month', occurred_at), 'Mon YYYY') as month,
      COUNT(*) as incidents,
      COUNT(*) FILTER (WHERE severity IN ('high','critical')) as critical_incidents
     FROM incidents
     WHERE occurred_at >= NOW() - INTERVAL '6 months'
     GROUP BY date_trunc('month', occurred_at)
     ORDER BY date_trunc('month', occurred_at) ASC`
  );

  sendSuccess(res, {
    systemStats,
    recentIncidents,
    riskVillages,
    speciesStats,
    monthlyTrends,
  }, 'Admin dashboard data retrieved');
}));

// GET /api/dashboard/analytics
router.get('/analytics', authenticate, authorize('admin', 'super_admin', 'forest_officer'), asyncHandler(async (_req: Request, res: Response) => {
  const heatmapData = await query(
    `SELECT 
      v.name, v.latitude, v.longitude, v.risk_level,
      COUNT(i.id) as incident_count,
      AVG(
        CASE i.severity 
          WHEN 'critical' THEN 4 WHEN 'high' THEN 3 
          WHEN 'medium' THEN 2 ELSE 1 
        END
      ) as avg_severity_score
     FROM villages v
     LEFT JOIN incidents i ON i.village_id = v.id AND i.occurred_at >= NOW() - INTERVAL '90 days'
     WHERE v.is_active = TRUE
     GROUP BY v.id ORDER BY incident_count DESC`
  );

  const speciesHeatmap = await query(
    `SELECT am.latitude, am.longitude, a.species, am.recorded_at
     FROM animal_movements am JOIN animals a ON a.id = am.animal_id
     WHERE am.recorded_at >= NOW() - INTERVAL '30 days'
     ORDER BY am.recorded_at DESC LIMIT 500`
  );

  const responseTimeStats = await query(
    `SELECT 
      AVG(EXTRACT(EPOCH FROM (rm.started_at - i.created_at))/60) as avg_response_minutes,
      MIN(EXTRACT(EPOCH FROM (rm.started_at - i.created_at))/60) as min_response_minutes,
      MAX(EXTRACT(EPOCH FROM (rm.started_at - i.created_at))/60) as max_response_minutes
     FROM rescue_missions rm JOIN incidents i ON i.id = rm.incident_id
     WHERE rm.started_at IS NOT NULL`
  );

  sendSuccess(res, { heatmapData, speciesHeatmap, responseTimeStats }, 'Analytics retrieved');
}));

export default router;
