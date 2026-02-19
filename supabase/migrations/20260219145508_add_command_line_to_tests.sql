/*
  # Add command_line column to tests table

  ## Summary
  Adds a nullable text column `command_line` to the `tests` table to store
  the exact udpst shell command that was executed for each test. This enables
  diagnostics — users can see and reproduce the exact command from the UI.

  ## Changes
  - `tests`: new column `command_line TEXT` (nullable, no default)

  ## Notes
  - No RLS changes needed — existing policies already cover this column
  - Safe to run multiple times due to IF NOT EXISTS guard
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests'
      AND column_name = 'command_line'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE tests ADD COLUMN command_line TEXT;
  END IF;
END $$;
