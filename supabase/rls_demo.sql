-- ================================================================
-- GigCover — Public Read Policies for Hackathon Demo
-- Run in Supabase SQL Editor after schema.sql
-- ================================================================
-- These policies allow the frontend (anon key) to read all tables
-- without authentication. REMOVE BEFORE PRODUCTION.

-- Workers: allow public read
CREATE POLICY "Public read workers" ON gig_workers
  FOR SELECT USING (true);

-- Policies: allow public read
CREATE POLICY "Public read policies" ON policies
  FOR SELECT USING (true);

-- Claims: allow public read
CREATE POLICY "Public read claims" ON claims
  FOR SELECT USING (true);

-- Transactions: allow public read
CREATE POLICY "Public read transactions" ON transactions
  FOR SELECT USING (true);

-- Fraud logs: allow public read (demo only)
DROP POLICY IF EXISTS "Service role only for fraud logs" ON fraud_logs;
CREATE POLICY "Public read fraud logs" ON fraud_logs
  FOR SELECT USING (true);

-- Trigger events & audit log: enable RLS + public read
ALTER TABLE trigger_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trigger events" ON trigger_events
  FOR SELECT USING (true);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read audit log" ON audit_log
  FOR SELECT USING (true);
CREATE POLICY "Anon insert audit log" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Allow anon inserts for demo (seed from frontend / API)
CREATE POLICY "Anon insert workers" ON gig_workers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert policies" ON policies
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert claims" ON claims
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert transactions" ON transactions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert weather" ON weather_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert fraud logs" ON fraud_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert trigger events" ON trigger_events
  FOR INSERT WITH CHECK (true);
