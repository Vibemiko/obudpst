import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';
import { config } from '../config.js';
import { parseUdpstOutput } from '../utils/parser.js';
import * as db from './database.js';

const runningProcesses = new Map();

export async function checkBinary() {
  try {
    await access(config.udpst.binaryPath, constants.X_OK);
    return {
      available: true,
      path: config.udpst.binaryPath
    };
  } catch (error) {
    return {
      available: false,
      path: config.udpst.binaryPath,
      error: error.message
    };
  }
}

export async function startServer(params) {
  const existingServer = await db.getActiveServerInstance();
  if (existingServer && runningProcesses.has(existingServer.process_id)) {
    throw new Error('Server already running');
  }

  const args = [];

  if (params.port && params.port !== config.udpst.defaultPort) {
    args.push('-p', params.port.toString());
  }

  if (params.daemon) {
    args.push('-x');
  }

  if (params.authKey) {
    args.push('-a', params.authKey);
  }

  if (params.verbose) {
    args.push('-v');
  }

  if (params.interface) {
    args.push(params.interface);
  }

  const proc = spawn(config.udpst.binaryPath, args, {
    detached: params.daemon,
    stdio: params.daemon ? 'ignore' : ['ignore', 'pipe', 'pipe']
  });

  const processId = `server_${Date.now()}`;

  runningProcesses.set(processId, {
    process: proc,
    type: 'server',
    startTime: new Date()
  });

  await db.createServerInstance({
    processId,
    pid: proc.pid,
    port: params.port || config.udpst.defaultPort,
    interface: params.interface || '',
    config: params
  });

  if (params.daemon) {
    proc.unref();
  } else {
    let stdoutData = '';
    let stderrData = '';

    proc.stdout?.on('data', (data) => {
      stdoutData += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    proc.on('exit', async (code) => {
      runningProcesses.delete(processId);
      await db.updateServerInstance(processId, {
        status: 'stopped',
        stopped_at: new Date().toISOString()
      });
    });
  }

  return {
    processId,
    pid: proc.pid,
    config: params
  };
}

export async function stopServer() {
  const serverInstance = await db.getActiveServerInstance();

  if (!serverInstance) {
    throw new Error('No server running');
  }

  const processInfo = runningProcesses.get(serverInstance.process_id);

  if (processInfo) {
    processInfo.process.kill('SIGTERM');
    runningProcesses.delete(serverInstance.process_id);
  } else {
    try {
      process.kill(serverInstance.pid, 'SIGTERM');
    } catch (error) {
    }
  }

  await db.updateServerInstance(serverInstance.process_id, {
    status: 'stopped',
    stopped_at: new Date().toISOString()
  });

  return { success: true };
}

export async function getServerStatus() {
  const serverInstance = await db.getActiveServerInstance();

  if (!serverInstance) {
    return {
      running: false
    };
  }

  const processInfo = runningProcesses.get(serverInstance.process_id);
  const uptime = processInfo
    ? Math.floor((Date.now() - processInfo.startTime.getTime()) / 1000)
    : null;

  return {
    running: true,
    processId: serverInstance.process_id,
    pid: serverInstance.pid,
    uptime,
    config: serverInstance.config
  };
}

export async function startClientTest(params) {
  const testId = `test_${Date.now()}`;

  const testRecord = await db.createTest({
    testId,
    testType: params.testType,
    servers: params.servers,
    config: params
  });

  const args = [];

  if (params.testType === 'upstream') {
    args.push('-u');
  } else if (params.testType === 'downstream') {
    args.push('-d');
  }

  args.push(...params.servers);

  if (params.port && params.port !== config.udpst.defaultPort) {
    args.push('-p', params.port.toString());
  }

  if (params.connections && params.connections > 1) {
    args.push('-C', params.connections.toString());
  }

  if (params.duration) {
    args.push('-t', params.duration.toString());
  }

  if (params.bandwidth) {
    args.push('-B', params.bandwidth.toString());
  }

  if (params.ipVersion === 'ipv4') {
    args.push('-4');
  } else if (params.ipVersion === 'ipv6') {
    args.push('-6');
  }

  if (!params.jumboFrames) {
    args.push('-j');
  }

  if (params.verbose) {
    args.push('-v');
  }

  if (params.jsonOutput) {
    args.push('-f', 'json');
  }

  const proc = spawn(config.udpst.binaryPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  runningProcesses.set(testId, {
    process: proc,
    type: 'client',
    startTime: new Date()
  });

  await db.updateTest(testId, {
    status: 'running',
    pid: proc.pid,
    started_at: new Date().toISOString()
  });

  let stdoutData = '';
  let stderrData = '';

  proc.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  proc.on('exit', async (code, signal) => {
    runningProcesses.delete(testId);

    const completedAt = new Date().toISOString();

    if (code === 0) {
      try {
        const results = parseUdpstOutput(stdoutData);

        await db.saveTestResults(testId, results);

        await db.updateTest(testId, {
          status: 'completed',
          completed_at: completedAt
        });
      } catch (error) {
        await db.updateTest(testId, {
          status: 'failed',
          error_message: `Failed to parse results: ${error.message}`,
          completed_at: completedAt
        });
      }
    } else {
      await db.updateTest(testId, {
        status: 'failed',
        error_message: stderrData || `Process exited with code ${code}`,
        completed_at: completedAt
      });
    }
  });

  return { testId, status: 'running' };
}

export async function getTestStatus(testId) {
  const test = await db.getTest(testId);

  if (!test) {
    throw new Error('Test not found');
  }

  const processInfo = runningProcesses.get(testId);
  const progress = processInfo && test.config?.duration
    ? Math.min(100, Math.floor(((Date.now() - processInfo.startTime.getTime()) / 1000) / test.config.duration * 100))
    : test.status === 'completed' ? 100 : 0;

  return {
    testId: test.test_id,
    status: test.status,
    progress,
    startTime: test.started_at
  };
}

export async function getTestResults(testId) {
  const testWithResults = await db.getTestWithResults(testId);

  if (!testWithResults) {
    throw new Error('Test not found');
  }

  const result = testWithResults.test_results?.[0];

  return {
    testId: testWithResults.test_id,
    status: testWithResults.status,
    results: result ? {
      throughput: parseFloat(result.throughput_mbps),
      packetLoss: parseFloat(result.packet_loss_percent),
      latency: parseFloat(result.latency_ms),
      jitter: parseFloat(result.jitter_ms),
      duration: testWithResults.config?.duration,
      connections: testWithResults.config?.connections
    } : null,
    rawOutput: result?.raw_output || null,
    completedAt: testWithResults.completed_at,
    errorMessage: testWithResults.error_message
  };
}

export async function stopTest(testId) {
  const processInfo = runningProcesses.get(testId);

  if (!processInfo) {
    throw new Error('Test not running');
  }

  processInfo.process.kill('SIGTERM');
  runningProcesses.delete(testId);

  await db.updateTest(testId, {
    status: 'stopped',
    completed_at: new Date().toISOString()
  });

  return { success: true };
}

export async function listTests(params) {
  return db.listTests(params);
}
