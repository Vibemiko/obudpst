/*
  # Fix tests status constraint and test_results RLS policies

  1. Modified Tables
    - `tests`: Add 'completed_partial' to allowed status values
  
  2. Security Changes
    - `test_results`: Add DELETE policy for public access (required by deleteTest/deleteAllTests)
    - `test_results`: Add UPDATE policy for public access

  3. Important Notes
    - The backend sets status to 'completed_partial' when a test collects partial data,
      but the original constraint only allowed: pending, running, completed, completed_warnings, failed, stopped
    - Without the DELETE policy on test_results, cascade deletes from the tests table 
      via the API were failing silently
*/

DO $$
BEGIN
  ALTER TABLE tests DROP CONSTRAINT IF EXISTS tests_status_check;
  ALTER TABLE tests ADD CONSTRAINT tests_status_check 
    CHECK (status IN ('pending', 'running', 'completed', 'completed_warnings', 'completed_partial', 'failed', 'stopped'));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'test_results'::regclass 
    AND polname = 'Allow public delete access to test_results'
  ) THEN
    CREATE POLICY "Allow public delete access to test_results"
      ON test_results
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'test_results'::regclass 
    AND polname = 'Allow public update access to test_results'
  ) THEN
    CREATE POLICY "Allow public update access to test_results"
      ON test_results
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
