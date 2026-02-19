/*
  # Add warning_messages field to tests table

  ## Changes
  - Add `warning_messages` column to `tests` table to store non-fatal warnings
  - Update status check constraint to include 'completed_warnings' status

  ## Details

  ### Modified Tables

  #### `tests`
  - Added `warning_messages` (text) - Stores warning messages for tests that complete with warnings
  - Updated `status` constraint to include 'completed_warnings' for tests that succeed but have non-critical issues

  ## Purpose

  Distinguish between:
  - `completed` - Clean successful completion
  - `completed_warnings` - Successful with warnings (e.g., downstream test connection warnings)
  - `failed` - Test failure with no usable data

  This is particularly important for downstream tests which always show "connection unavailable"
  warnings after test completion due to UDPST client-server termination behavior.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'warning_messages'
  ) THEN
    ALTER TABLE tests ADD COLUMN warning_messages text;
  END IF;
END $$;

ALTER TABLE tests DROP CONSTRAINT IF EXISTS tests_status_check;
ALTER TABLE tests ADD CONSTRAINT tests_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'completed_warnings', 'failed', 'stopped'));