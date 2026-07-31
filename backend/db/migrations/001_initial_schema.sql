-- GirShield AI Database Schema
-- PostgreSQL Production Schema

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enums
CREATE TYPE user_role AS ENUM ('villager', 'forest_officer', 'admin', 'super_admin');
CREATE TYPE alert_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE incident_status AS ENUM ('reported', 'acknowledged', 'responding', 'resolved', 'closed');
CREATE TYPE animal_species AS ENUM ('asiatic_lion', 'leopard', 'hyena', 'wolf', 'other');
CREATE TYPE mission_status AS ENUM ('pending', 'active', 'completed', 'cancelled');
CREATE TYPE compensation_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'disbursed');
CREATE TYPE incident_type AS ENUM ('livestock_attack', 'property_damage', 'human_encounter', 'human_injury', 'human_fatality', 'crop_damage');
CREATE TYPE notification_type AS ENUM ('alert', 'system', 'compensation', 'incident', 'mission');
CREATE TYPE movement_source AS ENUM ('gps_collar', 'field_observation', 'camera_trap', 'ai_prediction');

-- Villages
CREATE TABLE villages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  taluka VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL DEFAULT 'Junagadh',
  state VARCHAR(100) NOT NULL DEFAULT 'Gujarat',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  population INTEGER DEFAULT 0,
  households INTEGER DEFAULT 0,
  risk_level alert_level DEFAULT 'low',
  buffer_zone_km DECIMAL(5, 2) DEFAULT 5.0,
  nearest_forest_km DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'villager',
  village_id UUID REFERENCES villages(id) ON DELETE SET NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  device_info TEXT,
  ip_address INET,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP Verifications
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  attempts INTEGER DEFAULT 0,
  is_used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Animals
CREATE TABLE animals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  species animal_species NOT NULL,
  gender VARCHAR(10) DEFAULT 'unknown',
  age_estimate_years INTEGER,
  collar_id VARCHAR(50) UNIQUE,
  is_gps_tagged BOOLEAN DEFAULT FALSE,
  last_known_latitude DECIMAL(10, 8),
  last_known_longitude DECIMAL(11, 8),
  last_seen_at TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown',
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Animal Movements
CREATE TABLE animal_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude DECIMAL(8, 2),
  speed_kmph DECIMAL(5, 2),
  heading_degrees DECIMAL(5, 2),
  temperature_c DECIMAL(5, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source movement_source NOT NULL DEFAULT 'field_observation',
  confidence DECIMAL(5, 4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GPS Logs
CREATE TABLE gps_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  collar_id VARCHAR(50) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  battery_level INTEGER,
  signal_strength INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  village_id UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
  level alert_level NOT NULL DEFAULT 'medium',
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  radius_km DECIMAL(5, 2) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  notification_sent BOOLEAN DEFAULT FALSE,
  acknowledged_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  village_id UUID NOT NULL REFERENCES villages(id),
  reported_by UUID NOT NULL REFERENCES users(id),
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  type incident_type NOT NULL,
  status incident_status NOT NULL DEFAULT 'reported',
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  photos TEXT[] DEFAULT '{}',
  assigned_officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rescue_mission_id UUID,
  severity alert_level NOT NULL DEFAULT 'medium',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Livestock
CREATE TABLE livestock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  village_id UUID NOT NULL REFERENCES villages(id),
  animal_type VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  estimated_value DECIMAL(10, 2),
  tag_number VARCHAR(50),
  description TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forest Officers
CREATE TABLE forest_officers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  officer_id VARCHAR(50) UNIQUE NOT NULL,
  designation VARCHAR(100) NOT NULL,
  zone VARCHAR(100),
  beat VARCHAR(100),
  division VARCHAR(100),
  is_on_duty BOOLEAN DEFAULT TRUE,
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,
  qualifications TEXT,
  joined_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rescue Missions
CREATE TABLE rescue_missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  lead_officer_id UUID NOT NULL REFERENCES forest_officers(id),
  team_member_ids UUID[] DEFAULT '{}',
  status mission_status NOT NULL DEFAULT 'pending',
  title VARCHAR(300) NOT NULL,
  description TEXT,
  start_latitude DECIMAL(10, 8),
  start_longitude DECIMAL(11, 8),
  target_latitude DECIMAL(10, 8),
  target_longitude DECIMAL(11, 8),
  eta_minutes INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compensation
CREATE TABLE compensation_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  applicant_id UUID NOT NULL REFERENCES users(id),
  village_id UUID NOT NULL REFERENCES villages(id),
  type VARCHAR(50) NOT NULL,
  status compensation_status NOT NULL DEFAULT 'pending',
  claimed_amount DECIMAL(12, 2) NOT NULL,
  approved_amount DECIMAL(12, 2),
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  livestock_details JSONB,
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Predictions
CREATE TABLE ai_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  species animal_species NOT NULL,
  predicted_latitude DECIMAL(10, 8) NOT NULL,
  predicted_longitude DECIMAL(11, 8) NOT NULL,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  threat_score DECIMAL(5, 4) NOT NULL,
  confidence_percent DECIMAL(5, 2) NOT NULL,
  alert_level alert_level NOT NULL,
  affected_village_ids UUID[] DEFAULT '{}',
  movement_route JSONB,
  safe_radius_km DECIMAL(5, 2) DEFAULT 3.0,
  model_version VARCHAR(50) DEFAULT '1.0.0',
  input_features JSONB NOT NULL DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'system',
  title VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(300) NOT NULL,
  type VARCHAR(50) NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id),
  parameters JSONB DEFAULT '{}',
  file_url TEXT,
  file_size_bytes INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Config
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_village_id ON users(village_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_animal_movements_animal_id ON animal_movements(animal_id);
CREATE INDEX idx_animal_movements_recorded_at ON animal_movements(recorded_at DESC);
CREATE INDEX idx_alerts_village_id ON alerts(village_id);
CREATE INDEX idx_alerts_is_active ON alerts(is_active);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_incidents_village_id ON incidents(village_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_reported_by ON incidents(reported_by);
CREATE INDEX idx_incidents_assigned_officer ON incidents(assigned_officer_id);
CREATE INDEX idx_ai_predictions_species ON ai_predictions(species);
CREATE INDEX idx_ai_predictions_alert_level ON ai_predictions(alert_level);
CREATE INDEX idx_ai_predictions_valid_until ON ai_predictions(valid_until);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_compensation_applicant ON compensation_claims(applicant_id);
CREATE INDEX idx_compensation_status ON compensation_claims(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_villages_updated_at BEFORE UPDATE ON villages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_animals_updated_at BEFORE UPDATE ON animals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_livestock_updated_at BEFORE UPDATE ON livestock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forest_officers_updated_at BEFORE UPDATE ON forest_officers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rescue_missions_updated_at BEFORE UPDATE ON rescue_missions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compensation_updated_at BEFORE UPDATE ON compensation_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
