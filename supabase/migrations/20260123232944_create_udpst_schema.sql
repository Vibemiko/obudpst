/*
  # OB-UDPST Orchestration Database Schema

  ## Overview
  Database schema for storing OB-UDPST test configurations, execution state, 
  and results for the Web GUI and Control API.

  ## Tables Created

  ### 1. `tests`
  Stores test configuration and execution metadata
  - `id` (uuid, primary key)
  - `test_id` (text, unique) - Human-readable test identifier
  - `test_type` (text) - "upstream" or "downstream"
  - `status` (text) - "pending", "running", "completed", "failed", "stopped"
  - `servers` (jsonb) - Array of server addresses
  - `config` (jsonb) - Full test configuration
  - `pid` (integer) - Process ID of running test
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `test_results`
  Stores parsed test results and raw output
  - `id` (uuid, primary key)
  - `test_id` (uuid, foreign key) - References tests(id)
  - `throughput_mbps` (numeric) - Measured throughput
  - `packet_loss_percent` (numeric) - Packet loss percentage
  - `latency_ms` (numeric) - Latency in milliseconds
  - `jitter_ms` (numeric) - Jitter in milliseconds
  - `raw_output` (jsonb) - Complete JSON output from OB-UDPST
  - `created_at` (timestamptz)

  ### 3. `server_instances`
  Tracks running OB-UDPST server instances
  - `id` (uuid, primary key)
  - `process_id` (text, unique) - Human-readable process identifier
  - `pid` (integer) - System process ID
  - `port` (integer) - Control port
  - `interface` (text) - Bound interface IP
  - `status` (text) - "running", "stopped"
  - `config` (jsonb) - Server configuration
  - `started_at` (timestamptz)
  - `stopped_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public access policies for demo/development
  - Production deployments should restrict access
*/

CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id text UNIQUE NOT NULL,
  test_type text NOT NULL CHECK (test_type IN ('upstream', 'downstream')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
  servers jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  pid integer,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  throughput_mbps numeric(10, 2),
  packet_loss_percent numeric(10, 4),
  latency_ms numeric(10, 2),
  jitter_ms numeric(10, 2),
  raw_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS server_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id text UNIQUE NOT NULL,
  pid integer NOT NULL,
  port integer NOT NULL,
  interface text DEFAULT '',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  stopped_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to tests"
  ON tests
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to tests"
  ON tests
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to tests"
  ON tests
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to tests"
  ON tests
  FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to test_results"
  ON test_results
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to test_results"
  ON test_results
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public read access to server_instances"
  ON server_instances
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to server_instances"
  ON server_instances
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to server_instances"
  ON server_instances
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to server_instances"
  ON server_instances
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_tests_test_id ON tests(test_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_server_instances_process_id ON server_instances(process_id);
CREATE INDEX IF NOT EXISTS idx_server_instances_status ON server_instances(status);
