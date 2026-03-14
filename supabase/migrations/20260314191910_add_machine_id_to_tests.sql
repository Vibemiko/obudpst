/*
  # Add machine_id to tests table

  ## Changes
  - Adds `machine_id` column to `tests` table to store the originating machine identifier

  ## Purpose
  Links each test run to the machine that initiated it, enabling the history view
  to display which machine ran each test.

  ## Notes
  - Column is nullable (no default) since historical records won't have this data
  - machine_id is resolved from /sys/class/dmi/id/product_uuid or hostname in the backend config
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'machine_id'
  ) THEN
    ALTER TABLE tests ADD COLUMN machine_id text;
  END IF;
END $$;
