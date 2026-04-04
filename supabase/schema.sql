-- ================================================================
-- GigCover — Supabase Database Schema v3.0
-- AI-Powered Parametric Insurance for Gig Workers
-- ================================================================
-- Run this entire file in the Supabase SQL Editor (one shot).
-- Tables are ordered by dependency so all FK references resolve.
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ════════════════════════════════════════════════════════════
-- 1. WEATHER EVENTS  (no FK deps — must come before claims)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS weather_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city          TEXT NOT NULL,
  zone          TEXT NOT NULL,
  rainfall_mm   DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (rainfall_mm >= 0),
  temp_c        DOUBLE PRECISION NOT NULL DEFAULT 35,
  aqi           INTEGER NOT NULL DEFAULT 100 CHECK (aqi >= 0),
  wind_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 10 CHECK (wind_speed_kmh >= 0),
  humidity      DOUBLE PRECISION DEFAULT 60 CHECK (humidity BETWEEN 0 AND 100),
  triggers_fired TEXT[] DEFAULT '{}',
  is_extreme    BOOLEAN DEFAULT FALSE,
  severity      TEXT GENERATED ALWAYS AS (
                  CASE
                    WHEN is_extreme = TRUE AND (rainfall_mm >= 100 OR wind_speed_kmh >= 60) THEN 'critical'
                    WHEN is_extreme = TRUE THEN 'high'
                    WHEN rainfall_mm >= 15 OR aqi >= 200 OR temp_c >= 40 THEN 'medium'
                    ELSE 'low'
                  END
                ) STORED,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  source        TEXT DEFAULT 'openweathermap',
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 2. ZONES
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city            TEXT NOT NULL,
  zone_name       TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  risk_level      TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  flood_prone     BOOLEAN DEFAULT FALSE,
  density         TEXT DEFAULT 'medium' CHECK (density IN ('low', 'medium', 'high')),
  current_rainfall DOUBLE PRECISION DEFAULT 0,
  current_aqi     INTEGER DEFAULT 100,
  current_temp    DOUBLE PRECISION DEFAULT 32,
  current_wind    DOUBLE PRECISION DEFAULT 10,
  active_workers  INTEGER DEFAULT 0,
  active_policies INTEGER DEFAULT 0,
  total_claims    INTEGER DEFAULT 0,
  total_payouts   NUMERIC(12,2) DEFAULT 0,
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city, zone_name)
);

-- ════════════════════════════════════════════════════════════
-- 3. GIG WORKERS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gig_workers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id         TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  phone             TEXT UNIQUE NOT NULL,
  email             TEXT UNIQUE,
  platform          TEXT NOT NULL CHECK (platform IN ('Swiggy', 'Zomato', 'Amazon', 'Zepto', 'Blinkit', 'Dunzo')),
  city              TEXT NOT NULL,
  zone              TEXT NOT NULL,
  plan              TEXT NOT NULL DEFAULT 'standard' CHECK (plan IN ('basic', 'standard', 'pro')),
  weekly_premium    NUMERIC(10,2) NOT NULL DEFAULT 25,
  max_payout        NUMERIC(10,2) NOT NULL DEFAULT 1500,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  avg_daily_earnings NUMERIC(10,2) DEFAULT 800,
  total_earnings    NUMERIC(12,2) DEFAULT 0,
  total_claims      INTEGER DEFAULT 0,
  total_payouts     NUMERIC(12,2) DEFAULT 0,
  fraud_flags       INTEGER DEFAULT 0,
  risk_score        DOUBLE PRECISION DEFAULT 0.3 CHECK (risk_score BETWEEN 0 AND 1),
  auth_user_id      UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 4. POLICIES
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id       TEXT UNIQUE NOT NULL,
  worker_id       UUID NOT NULL REFERENCES gig_workers(id) ON DELETE CASCADE,
  plan            TEXT NOT NULL CHECK (plan IN ('basic', 'standard', 'pro')),
  weekly_premium  NUMERIC(10,2) NOT NULL,
  max_payout      NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  coverage_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coverage_end    TIMESTAMPTZ,
  auto_renew      BOOLEAN DEFAULT TRUE,
  renewal_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 5. CLAIMS  (depends on gig_workers, policies, weather_events)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claims (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id         TEXT UNIQUE NOT NULL,
  worker_id        UUID NOT NULL REFERENCES gig_workers(id) ON DELETE CASCADE,
  policy_id        UUID REFERENCES policies(id),
  trigger_type     TEXT NOT NULL CHECK (trigger_type IN ('heavy_rain', 'flood', 'heatwave', 'aqi', 'storm', 'curfew')),
  weather_event_id UUID REFERENCES weather_events(id),
  city             TEXT NOT NULL,
  zone             TEXT NOT NULL,
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status           TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'paid', 'flagged', 'rejected')),
  auto_triggered   BOOLEAN DEFAULT FALSE,
  fraud_score      DOUBLE PRECISION DEFAULT 0 CHECK (fraud_score BETWEEN 0 AND 1),
  process_time     TEXT,
  payout_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 6. TRANSACTIONS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id   UUID NOT NULL REFERENCES gig_workers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('premium', 'payout', 'bonus', 'refund')),
  amount      NUMERIC(10,2) NOT NULL,
  description TEXT,
  claim_id    UUID REFERENCES claims(id),
  status      TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 7. FRAUD LOGS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fraud_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id    UUID REFERENCES gig_workers(id),
  claim_id     UUID REFERENCES claims(id),
  fraud_score  DOUBLE PRECISION NOT NULL CHECK (fraud_score BETWEEN 0 AND 1),
  risk_level   TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  reason       TEXT,
  shap_values  JSONB,
  model_version TEXT DEFAULT '3.0',
  status       TEXT DEFAULT 'investigating' CHECK (status IN ('investigating', 'cleared', 'blocked')),
  resolved_by  TEXT,
  resolved_at  TIMESTAMPTZ,
  detected_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 8. TRIGGER EVENTS
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS trigger_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_type    TEXT NOT NULL,
  city            TEXT NOT NULL,
  zone            TEXT NOT NULL,
  measured_value  DOUBLE PRECISION NOT NULL,
  threshold_value DOUBLE PRECISION NOT NULL,
  workers_affected INTEGER DEFAULT 0,
  total_payout    NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  is_manual       BOOLEAN DEFAULT FALSE,
  weather_event_id UUID REFERENCES weather_events(id),
  triggered_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- 9. INCIDENT RUNS (admin-triggered simulations and fire drills)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS incident_runs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city                  TEXT NOT NULL,
  zone                  TEXT NOT NULL,
  trigger_type          TEXT NOT NULL CHECK (trigger_type IN ('heavy_rain', 'flood', 'heatwave', 'aqi', 'storm', 'curfew')),
  mode                  TEXT NOT NULL DEFAULT 'simulate' CHECK (mode IN ('simulate', 'fire')),
  workers_affected      INTEGER NOT NULL DEFAULT 0,
  total_estimated_payout NUMERIC(12,2) DEFAULT 0,
  avg_payout_per_worker NUMERIC(10,2) DEFAULT 0,
  threshold_value       DOUBLE PRECISION NOT NULL DEFAULT 0,
  measured_value        DOUBLE PRECISION NOT NULL DEFAULT 0,
  trigger_event_id      UUID REFERENCES trigger_events(id),
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  duration_ms           INTEGER
);

-- ════════════════════════════════════════════════════════════
-- 10. CLAIM APPEALS (worker review requests for fraud-flagged claims)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS claim_appeals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_public_id  TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  claim_row_id     UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  worker_id        UUID NOT NULL REFERENCES gig_workers(id) ON DELETE CASCADE,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'accepted', 'rejected')),
  reviewer         TEXT,
  resolution_note  TEXT,
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════════
-- 11. AUDIT LOG  (tracks every state change for compliance)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  TEXT DEFAULT current_user,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- INDEXES — Optimised for dashboard queries
-- ════════════════════════════════════════════════════════════

-- Workers
CREATE INDEX IF NOT EXISTS idx_workers_city ON gig_workers(city);
CREATE INDEX IF NOT EXISTS idx_workers_platform ON gig_workers(platform);
CREATE INDEX IF NOT EXISTS idx_workers_status ON gig_workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_city_zone ON gig_workers(city, zone);
CREATE INDEX IF NOT EXISTS idx_workers_risk ON gig_workers(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_workers_created ON gig_workers(created_at DESC);

-- Policies
CREATE INDEX IF NOT EXISTS idx_policies_worker ON policies(worker_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_coverage ON policies(coverage_start, coverage_end);

-- Claims (heavily queried)
CREATE INDEX IF NOT EXISTS idx_claims_worker ON claims(worker_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_trigger ON claims(trigger_type);
CREATE INDEX IF NOT EXISTS idx_claims_city_zone ON claims(city, zone);
CREATE INDEX IF NOT EXISTS idx_claims_created ON claims(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_fraud ON claims(fraud_score DESC) WHERE fraud_score > 0.5;

-- Weather
CREATE INDEX IF NOT EXISTS idx_weather_city_zone ON weather_events(city, zone);
CREATE INDEX IF NOT EXISTS idx_weather_recorded ON weather_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_extreme ON weather_events(city, zone, recorded_at DESC) WHERE is_extreme = TRUE;

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_worker ON transactions(worker_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- Fraud
CREATE INDEX IF NOT EXISTS idx_fraud_worker ON fraud_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_fraud_status ON fraud_logs(status) WHERE status = 'investigating';
CREATE INDEX IF NOT EXISTS idx_fraud_score ON fraud_logs(fraud_score DESC);

-- Triggers
CREATE INDEX IF NOT EXISTS idx_triggers_city ON trigger_events(city, zone);
CREATE INDEX IF NOT EXISTS idx_triggers_type ON trigger_events(trigger_type);
CREATE INDEX IF NOT EXISTS idx_triggers_time ON trigger_events(triggered_at DESC);

-- Incident runs
CREATE INDEX IF NOT EXISTS idx_incident_runs_city_zone ON incident_runs(city, zone);
CREATE INDEX IF NOT EXISTS idx_incident_runs_started ON incident_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_runs_trigger ON incident_runs(trigger_type);

-- Claim appeals
CREATE INDEX IF NOT EXISTS idx_claim_appeals_claim_public ON claim_appeals(claim_public_id);
CREATE INDEX IF NOT EXISTS idx_claim_appeals_status ON claim_appeals(status);
CREATE INDEX IF NOT EXISTS idx_claim_appeals_worker ON claim_appeals(worker_id);
CREATE INDEX IF NOT EXISTS idx_claim_appeals_submitted ON claim_appeals(submitted_at DESC);

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(changed_at DESC);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE gig_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_appeals ENABLE ROW LEVEL SECURITY;

-- Workers see their own data
DROP POLICY IF EXISTS "Workers read own data" ON gig_workers;
CREATE POLICY "Workers read own data" ON gig_workers
  FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Workers update own data" ON gig_workers;
CREATE POLICY "Workers update own data" ON gig_workers
  FOR UPDATE USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Workers read own policies" ON policies;
CREATE POLICY "Workers read own policies" ON policies
  FOR SELECT USING (
    worker_id IN (SELECT id FROM gig_workers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Workers read own claims" ON claims;
CREATE POLICY "Workers read own claims" ON claims
  FOR SELECT USING (
    worker_id IN (SELECT id FROM gig_workers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Workers read own transactions" ON transactions;
CREATE POLICY "Workers read own transactions" ON transactions
  FOR SELECT USING (
    worker_id IN (SELECT id FROM gig_workers WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Workers read own appeals" ON claim_appeals;
CREATE POLICY "Workers read own appeals" ON claim_appeals
  FOR SELECT USING (
    worker_id IN (SELECT id FROM gig_workers WHERE auth_user_id = auth.uid())
  );

-- Fraud logs: only admins (via service role) can see
DROP POLICY IF EXISTS "Service role only for fraud logs" ON fraud_logs;
CREATE POLICY "Service role only for fraud logs" ON fraud_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Public read for zones and weather (non-sensitive reference data)
DROP POLICY IF EXISTS "Public read zones" ON zones;
CREATE POLICY "Public read zones" ON zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read weather" ON weather_events;
CREATE POLICY "Public read weather" ON weather_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read incident runs" ON incident_runs;
CREATE POLICY "Public read incident runs" ON incident_runs FOR SELECT USING (true);

-- Service role bypass for ML API writes (API uses service_role key)
DROP POLICY IF EXISTS "Service role full access workers" ON gig_workers;
CREATE POLICY "Service role full access workers" ON gig_workers
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access policies" ON policies;
CREATE POLICY "Service role full access policies" ON policies
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access claims" ON claims;
CREATE POLICY "Service role full access claims" ON claims
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access transactions" ON transactions;
CREATE POLICY "Service role full access transactions" ON transactions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access claim appeals" ON claim_appeals;
CREATE POLICY "Service role full access claim appeals" ON claim_appeals
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access incident runs" ON incident_runs;
CREATE POLICY "Service role full access incident runs" ON incident_runs
  FOR ALL USING (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON gig_workers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON gig_workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-increment worker's total_claims & total_payouts when a claim is paid
CREATE OR REPLACE FUNCTION on_claim_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE gig_workers
    SET total_claims = total_claims + 1,
        total_payouts = total_payouts + NEW.amount
    WHERE id = NEW.worker_id;

    -- Also update the zone stats
    UPDATE zones
    SET total_claims = total_claims + 1,
        total_payouts = total_payouts + NEW.amount,
        last_updated = NOW()
    WHERE city = NEW.city AND zone_name = NEW.zone;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claim_paid ON claims;
CREATE TRIGGER trg_claim_paid
  AFTER INSERT OR UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION on_claim_paid();

-- Auto-flag worker when fraud_flags crosses threshold
CREATE OR REPLACE FUNCTION on_fraud_threshold()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fraud_flags >= 3 AND OLD.fraud_flags < 3 THEN
    NEW.status = 'suspended';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fraud_suspend ON gig_workers;
CREATE TRIGGER trg_fraud_suspend
  BEFORE UPDATE ON gig_workers
  FOR EACH ROW EXECUTE FUNCTION on_fraud_threshold();

-- Auto-log fraud detections to fraud_logs table
CREATE OR REPLACE FUNCTION on_claim_fraud_detected()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fraud_score > 0.5 THEN
    INSERT INTO fraud_logs (worker_id, claim_id, fraud_score, risk_level, reason)
    VALUES (
      NEW.worker_id,
      NEW.id,
      NEW.fraud_score,
      CASE
        WHEN NEW.fraud_score > 0.8 THEN 'critical'
        WHEN NEW.fraud_score > 0.6 THEN 'high'
        ELSE 'medium'
      END,
      'Auto-detected by ML model (score: ' || ROUND(NEW.fraud_score::numeric, 3) || ')'
    );

    -- Increment fraud_flags on the worker
    UPDATE gig_workers
    SET fraud_flags = fraud_flags + 1
    WHERE id = NEW.worker_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fraud_detect ON claims;
CREATE TRIGGER trg_fraud_detect
  AFTER INSERT ON claims
  FOR EACH ROW EXECUTE FUNCTION on_claim_fraud_detected();

-- Audit trail for claims (compliance)
CREATE OR REPLACE FUNCTION audit_claims_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
    VALUES ('claims', OLD.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data)
    VALUES ('claims', NEW.id, 'INSERT', to_jsonb(NEW));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_claims ON claims;
CREATE TRIGGER trg_audit_claims
  AFTER INSERT OR UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION audit_claims_changes();

-- ════════════════════════════════════════════════════════════
-- VIEWS — Pre-built queries for dashboards
-- ════════════════════════════════════════════════════════════

-- Dashboard KPI summary (used by admin dashboard)
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM gig_workers WHERE status = 'active')            AS active_workers,
  (SELECT COUNT(*) FROM policies WHERE status = 'active')               AS active_policies,
  (SELECT COUNT(*) FROM claims)                                         AS total_claims,
  (SELECT COUNT(*) FROM claims WHERE status = 'paid')                   AS paid_claims,
  (SELECT COALESCE(SUM(amount), 0) FROM claims WHERE status = 'paid')   AS total_payouts,
  (SELECT COUNT(*) FROM claims WHERE fraud_score > 0.5)                 AS flagged_claims,
  (SELECT COUNT(*) FROM claims WHERE auto_triggered = TRUE AND status = 'paid') AS auto_payouts,
  (SELECT ROUND(AVG(fraud_score)::numeric, 3) FROM claims)              AS avg_fraud_score,
  (SELECT COUNT(*) FROM weather_events WHERE is_extreme = TRUE)         AS extreme_events;

-- Zone risk heatmap view
CREATE OR REPLACE VIEW v_zone_heatmap AS
SELECT
  z.city,
  z.zone_name,
  z.lat,
  z.lng,
  z.risk_level,
  z.flood_prone,
  z.density,
  z.current_rainfall,
  z.current_aqi,
  z.current_temp,
  z.current_wind,
  z.active_workers,
  z.active_policies,
  z.total_claims,
  z.total_payouts,
  (SELECT COUNT(*) FROM weather_events we
   WHERE we.city = z.city AND we.zone = z.zone_name AND we.is_extreme = TRUE) AS extreme_event_count,
  z.last_updated
FROM zones z
ORDER BY z.city, z.zone_name;

-- Recent claims with worker info (admin claims page)
CREATE OR REPLACE VIEW v_recent_claims AS
SELECT
  c.id,
  c.claim_id,
  c.city,
  c.zone,
  c.trigger_type,
  c.amount,
  c.status,
  c.auto_triggered,
  c.fraud_score,
  c.process_time,
  c.created_at,
  w.worker_id AS worker_gw_id,
  w.name AS worker_name,
  w.platform,
  w.plan
FROM claims c
JOIN gig_workers w ON c.worker_id = w.id
ORDER BY c.created_at DESC;

-- Fraud investigation queue
CREATE OR REPLACE VIEW v_fraud_queue AS
SELECT
  fl.id,
  fl.fraud_score,
  fl.risk_level,
  fl.reason,
  fl.shap_values,
  fl.status AS investigation_status,
  fl.detected_at,
  c.claim_id,
  c.trigger_type,
  c.amount AS claim_amount,
  c.city,
  c.zone,
  w.worker_id AS worker_gw_id,
  w.name AS worker_name,
  w.platform,
  w.fraud_flags,
  w.total_claims AS worker_total_claims
FROM fraud_logs fl
JOIN claims c ON fl.claim_id = c.id
JOIN gig_workers w ON fl.worker_id = w.id
WHERE fl.status = 'investigating'
ORDER BY fl.fraud_score DESC;

-- Worker risk leaderboard
CREATE OR REPLACE VIEW v_worker_risk AS
SELECT
  id,
  worker_id,
  name,
  platform,
  city,
  zone,
  plan,
  risk_score,
  fraud_flags,
  total_claims,
  total_payouts,
  status,
  created_at
FROM gig_workers
ORDER BY risk_score DESC;

-- ════════════════════════════════════════════════════════════
-- SEED ZONES  (25 zones matching generate_synthetic.py)
-- ════════════════════════════════════════════════════════════

INSERT INTO zones (city, zone_name, lat, lng, risk_level, flood_prone, density)
VALUES
  -- Mumbai
  ('Mumbai', 'Andheri West',       19.1314, 72.8296, 'high',     TRUE,  'high'),
  ('Mumbai', 'Bandra',             19.0596, 72.8295, 'medium',   FALSE, 'high'),
  ('Mumbai', 'Dadar',              19.0185, 72.8425, 'high',     TRUE,  'medium'),
  ('Mumbai', 'Colaba',             18.9067, 72.8147, 'low',      FALSE, 'low'),
  ('Mumbai', 'Powai',              19.1197, 72.9074, 'medium',   TRUE,  'medium'),
  -- Delhi
  ('Delhi', 'Connaught Place',     28.6315, 77.2167, 'medium',   FALSE, 'high'),
  ('Delhi', 'Dwarka',              28.5733, 77.0700, 'high',     TRUE,  'medium'),
  ('Delhi', 'Rohini',              28.7495, 77.0653, 'medium',   FALSE, 'medium'),
  ('Delhi', 'Saket',               28.5244, 77.2066, 'medium',   FALSE, 'high'),
  ('Delhi', 'Karol Bagh',          28.6434, 77.1883, 'high',     FALSE, 'high'),
  -- Bangalore
  ('Bangalore', 'Koramangala',     12.9352, 77.6245, 'high',     TRUE,  'high'),
  ('Bangalore', 'Indiranagar',     12.9784, 77.6408, 'medium',   FALSE, 'high'),
  ('Bangalore', 'Whitefield',      12.9698, 77.7500, 'high',     TRUE,  'medium'),
  ('Bangalore', 'Jayanagar',       12.9253, 77.5938, 'low',      FALSE, 'medium'),
  ('Bangalore', 'HSR Layout',      12.9116, 77.6389, 'high',     TRUE,  'high'),
  -- Chennai
  ('Chennai', 'T. Nagar',          13.0399, 80.2340, 'high',     TRUE,  'high'),
  ('Chennai', 'Adyar',             13.0012, 80.2565, 'medium',   TRUE,  'medium'),
  ('Chennai', 'Anna Nagar',        13.0850, 80.2101, 'low',      FALSE, 'medium'),
  ('Chennai', 'Mylapore',          13.0368, 80.2676, 'high',     TRUE,  'high'),
  ('Chennai', 'Velachery',         12.9815, 80.2180, 'medium',   TRUE,  'medium'),
  -- Hyderabad
  ('Hyderabad', 'Banjara Hills',   17.4156, 78.4347, 'low',      FALSE, 'high'),
  ('Hyderabad', 'Madhapur',        17.4484, 78.3908, 'medium',   TRUE,  'high'),
  ('Hyderabad', 'Secunderabad',    17.4399, 78.4983, 'low',      FALSE, 'medium'),
  ('Hyderabad', 'Kukatpally',      17.4849, 78.3873, 'medium',   TRUE,  'medium'),
  ('Hyderabad', 'Gachibowli',      17.4401, 78.3489, 'low',      FALSE, 'medium')
ON CONFLICT (city, zone_name) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- DONE — Schema ready for GigCover v3.0
-- ════════════════════════════════════════════════════════════
