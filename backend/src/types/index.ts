export type UserRole = 'villager' | 'forest_officer' | 'admin' | 'super_admin';
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'acknowledged' | 'responding' | 'resolved' | 'closed';
export type AnimalSpecies = 'asiatic_lion' | 'leopard' | 'hyena' | 'wolf' | 'other';
export type MissionStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type CompensationStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
export type NotificationType = 'alert' | 'system' | 'compensation' | 'incident' | 'mission';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  village_id?: string;
  is_verified: boolean;
  is_active: boolean;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Village {
  id: string;
  name: string;
  taluka: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  population: number;
  households: number;
  risk_level: AlertLevel;
  buffer_zone_km: number;
  is_active: boolean;
  created_at: Date;
}

export interface Animal {
  id: string;
  name: string;
  species: AnimalSpecies;
  gender: 'male' | 'female' | 'unknown';
  age_estimate_years?: number;
  collar_id?: string;
  is_gps_tagged: boolean;
  last_known_latitude?: number;
  last_known_longitude?: number;
  last_seen_at?: Date;
  health_status: 'healthy' | 'injured' | 'unknown';
  notes?: string;
  created_at: Date;
}

export interface AnimalMovement {
  id: string;
  animal_id: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmph?: number;
  heading_degrees?: number;
  recorded_at: Date;
  source: 'gps_collar' | 'field_observation' | 'camera_trap' | 'ai_prediction';
  confidence?: number;
  notes?: string;
}

export interface Alert {
  id: string;
  animal_id?: string;
  village_id: string;
  level: AlertLevel;
  title: string;
  message: string;
  latitude?: number;
  longitude?: number;
  radius_km: number;
  is_active: boolean;
  expires_at?: Date;
  created_by: string;
  created_at: Date;
}

export interface Incident {
  id: string;
  village_id: string;
  reported_by: string;
  animal_id?: string;
  type: 'livestock_attack' | 'property_damage' | 'human_encounter' | 'human_injury' | 'human_fatality' | 'crop_damage';
  status: IncidentStatus;
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  assigned_officer_id?: string;
  rescue_mission_id?: string;
  severity: AlertLevel;
  occurred_at: Date;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Prediction {
  id: string;
  animal_id?: string;
  species: AnimalSpecies;
  predicted_latitude: number;
  predicted_longitude: number;
  predicted_at: Date;
  valid_until: Date;
  threat_score: number;
  confidence_percent: number;
  alert_level: AlertLevel;
  affected_village_ids: string[];
  movement_route?: { latitude: number; longitude: number }[];
  safe_radius_km: number;
  model_version: string;
  input_features: Record<string, unknown>;
  created_at: Date;
}

export interface RescueMission {
  id: string;
  incident_id: string;
  lead_officer_id: string;
  team_members: string[];
  status: MissionStatus;
  title: string;
  description?: string;
  start_latitude?: number;
  start_longitude?: number;
  target_latitude?: number;
  target_longitude?: number;
  eta_minutes?: number;
  started_at?: Date;
  completed_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Compensation {
  id: string;
  incident_id: string;
  applicant_id: string;
  village_id: string;
  type: 'livestock' | 'property' | 'crop' | 'medical' | 'death';
  status: CompensationStatus;
  claimed_amount: number;
  approved_amount?: number;
  description: string;
  evidence_urls: string[];
  livestock_details?: Record<string, unknown>;
  reviewer_id?: string;
  review_notes?: string;
  submitted_at: Date;
  reviewed_at?: Date;
  disbursed_at?: Date;
  created_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: Date;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface RequestWithUser extends Express.Request {
  user: AuthPayload;
}
