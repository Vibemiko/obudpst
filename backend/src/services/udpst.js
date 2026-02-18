import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';
import { existsSync } from 'fs';
import { hostname } from 'os';
import { config } from '../config.js';
import { parseUdpstOutput } from '../utils/parser.js';
import * as db from './database.js';
import { logger } from '../utils/logger.js';

const runningProcesses = new Map();
const MACHINE_ID = process.env.MACHINE_ID || hostname();

function ensureBinaryExists() {
  if (!existsSync(config.udpst.binaryPath)) {
    const error = new Error(
      `UDPST binary not found at: ${config.udpst.binaryPath}\n` +
      'Please compile the binary by running "cmake . && make" in the project root.'
    );
    error.code = 'BINARY_NOT_FOUND';
    throw error;
  }
}

export async function checkBinary() {
  const result = {
    available: false,
    path: config.udpst.binaryPath,
    projectRoot: config.projectRoot
  };

  if (!existsSync(config.udpst.binaryPath)) {
    result.error = 'Binary file not found';
    result.hint = 'Run "cmake . && make" in the project root to compile the binary';
    return result;
  }

  try {
    await access(config.udpst.binaryPath, constants.X_OK);
    result.available = true;
    return result;
  } catch (error) {
    result.error = 'Binary exists but is not executable';
    result.hint = `Run "chmod +x ${config.udpst.binaryPath}" to make it executable`;
    return result;
  }
}

export async function startServer(params) {
  ensureBinaryExists();

  const existingServer = await db.getActiveServerInstance(MACHINE_ID);
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
    config: params,
    machineId: MACHINE_ID
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
  const serverInstance = await db.getActiveServerInstance(MACHINE_ID);

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
  const serverInstance = await db.getActiveServerInstance(MACHINE_ID);

  if (!serverInstance) {
    return {
      running: false,
      machineId: MACHINE_ID
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
    config: serverInstance.config,
    machineId: MACHINE_ID
  };
}

export async function startClientTest(params) {
  ensureBinaryExists();

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

  args.push(...params.servers);

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
  let processExited = false;

  proc.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  proc.on('error', async (error) => {
    if (!processExited) {
      processExited = true;
      runningProcesses.delete(testId);
      logger.error('Test process error', { testId, error: error.message });

      await db.updateTest(testId, {
        status: 'failed',
        error_message: `Process error: ${error.message}`,
        completed_at: new Date().toISOString()
      });
    }
  });

  proc.on('exit', async (code, signal) => {
    if (processExited) return;
    processExited = true;

    runningProcesses.delete(testId);

    const completedAt = new Date().toISOString();

    if (signal) {
      logger.info('Test process terminated by signal', { testId, signal });
      await db.updateTest(testId, {
        status: signal === 'SIGTERM' ? 'stopped' : 'failed',
        error_message: signal === 'SIGTERM' ? 'Test stopped by user' : `Process killed by signal: ${signal}`,
        completed_at: completedAt
      });
      return;
    }

    if (code === 0) {
      try {
        const results = parseUdpstOutput(stdoutData);
        logger.info('Test completed successfully', { testId, throughput: results.throughput });

        await db.saveTestResults(testId, results);

        await db.updateTest(testId, {
          status: 'completed',
          completed_at: completedAt
        });
      } catch (error) {
        logger.error('Failed to parse test results', { testId, error: error.message });
        await db.updateTest(testId, {
          status: 'failed',
          error_message: `Failed to parse results: ${error.message}`,
          completed_at: completedAt
        });
      }
    } else {
      const errorMsg = stderrData.trim() || stdoutData.trim() || `Process exited with code ${code}`;
      logger.warn('Test failed', { testId, exitCode: code, error: errorMsg.substring(0, 200) });
      await db.updateTest(testId, {
        status: 'failed',
        error_message: errorMsg,
        completed_at: completedAt
      });
    }
  });

  const testTimeout = (params.duration || 30) * 1000 + 60000;
  const timeoutId = setTimeout(async () => {
    if (runningProcesses.has(testId) && !processExited) {
      processExited = true;
      const processInfo = runningProcesses.get(testId);
      if (processInfo) {
        processInfo.process.kill('SIGTERM');
        runningProcesses.delete(testId);
      }

      logger.warn('Test timeout exceeded', { testId, timeout: testTimeout });
      await db.updateTest(testId, {
        status: 'failed',
        error_message: 'Test timeout exceeded',
        completed_at: new Date().toISOString()
      });
    }
  }, testTimeout);

  proc.on('exit', () => {
    clearTimeout(timeoutId);
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
