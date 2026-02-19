import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(config.supabase.url, config.supabase.anonKey);

export async function createTest(testData) {
  const { data, error } = await supabase
    .from('tests')
    .insert([{
      test_id: testData.testId,
      test_type: testData.testType,
      servers: testData.servers,
      config: testData.config,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTest(testId, updates) {
  const updateData = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('tests')
    .update(updateData)
    .eq('test_id', testId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTest(testId) {
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('test_id', testId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTestWithResults(testId) {
  const { data, error } = await supabase
    .from('tests')
    .select(`
      *,
      test_results (*)
    `)
    .eq('test_id', testId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listTests({ status, limit = 50, offset = 0 }) {
  let query = supabase
    .from('tests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { tests: data, total: count };
}

export async function saveTestResults(testId, results) {
  const test = await getTest(testId);
  if (!test) {
    throw new Error('Test not found');
  }

  const { data, error } = await supabase
    .from('test_results')
    .insert([{
      test_id: test.id,
      throughput_mbps: results.throughput,
      packet_loss_percent: results.packetLoss,
      latency_ms: results.latency,
      jitter_ms: results.jitter,
      raw_output: results.raw
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createServerInstance(instanceData) {
  const { data, error } = await supabase
    .from('server_instances')
    .insert([{
      process_id: instanceData.processId,
      pid: instanceData.pid,
      port: instanceData.port,
      interface: instanceData.interface || '',
      config: instanceData.config,
      status: 'running',
      machine_id: instanceData.machineId
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateServerInstance(processId, updates) {
  const { data, error } = await supabase
    .from('server_instances')
    .update(updates)
    .eq('process_id', processId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getServerInstance(processId) {
  const { data, error } = await supabase
    .from('server_instances')
    .select('*')
    .eq('process_id', processId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getActiveServerInstance(machineId) {
  let query = supabase
    .from('server_instances')
    .select('*')
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1);

  if (machineId) {
    query = query.eq('machine_id', machineId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteTest(testId) {
  const test = await getTest(testId);
  if (!test) {
    throw new Error('Test not found');
  }

  const { error: resultsError } = await supabase
    .from('test_results')
    .delete()
    .eq('test_id', test.id);

  if (resultsError) throw resultsError;

  const { error: testError } = await supabase
    .from('tests')
    .delete()
    .eq('test_id', testId);

  if (testError) throw testError;

  return { success: true };
}

export async function getActiveTests() {
  const { data, error } = await supabase
    .from('tests')
    .select('*')
    .eq('status', 'running')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteAllTests() {
  const { error: resultsError } = await supabase
    .from('test_results')
    .delete()
    .not('id', 'is', null);

  if (resultsError) throw resultsError;

  const { error: testsError } = await supabase
    .from('tests')
    .delete()
    .not('id', 'is', null);

  if (testsError) throw testsError;

  return { success: true };
}
