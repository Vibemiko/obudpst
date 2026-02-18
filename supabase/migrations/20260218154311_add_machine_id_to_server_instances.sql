/*
  # Add machine_id to server_instances table

  ## Summary
  This migration adds per-machine isolation to the server_instances table so that
  multiple VMs sharing the same Supabase project do not see each other's server state.

  ## Changes

  ### Modified Tables
  - `server_instances`
    - Added `machine_id` (text) column: stores the hostname of the machine that
      created the server instance. Defaults to 'unknown' for backward compatibility
      with existing rows.

  ## Why This Is Needed
  When two VMs run the same application against the same Supabase database, the
  server_instances table previously had no way to distinguish which machine owned
  which record. VM-A starting a server would appear as "running" on VM-B's GUI.
  The machine_id column (populated via os.hostname() in Node.js) ensures each VM
  queries and manages only its own server instances.

  ## Index
  An index on machine_id + status is added for efficient per-machine status queries.

  ## Notes
  - No data loss: existing rows receive machine_id = 'unknown'
  - Backward compatible: existing queries still work, new queries filter by machine_id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'server_instances' AND column_name = 'machine_id'
  ) THEN
    ALTER TABLE server_instances ADD COLUMN machine_id text NOT NULL DEFAULT 'unknown';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_server_instances_machine_status
  ON server_instances (machine_id, status);
