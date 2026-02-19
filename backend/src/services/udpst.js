import { spawn } from 'child_process';
import { access, constants } from 'fs/promises';
import { existsSync } from 'fs';
import { config } from '../config.js';
import { parseUdpstOutput, assessResultQuality, classifyErrorSeverity } from '../utils/parser.js';
import * as db from './database.js';
import { logger } from '../utils/logger.js';

const runningProcesses = new Map();

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

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function waitForServerReady(proc, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let exited = false;

    const exitHandler = (code) => {
      exited = true;
      reject(new Error(`Server process exited immediately with code ${code}`));
    };

    proc.once('exit', exitHandler);

    setTimeout(() => {
      proc.removeListener('exit', exitHandler);
      if (!exited) {
        resolve();
      }
    }, timeoutMs);
  });
}

export async function startServer(params) {
  ensureBinaryExists();

  const existingServer = await db.getActiveServerInstance(config.machineId);
  if (existingServer) {
    if (runningProcesses.has(existingServer.process_id)) {
      throw new Error('Server already running');
    }
    if (existingServer.pid && isProcessAlive(existingServer.pid)) {
      throw new Error('Server already running');
    }
    await db.updateServerInstance(existingServer.process_id, {
      status: 'stopped',
      stopped_at: new Date().toISOString()
    });
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

  if (params.ipVersion === 'ipv6') {
    args.push('-6');
  } else {
    args.push('-4');
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
    machineId: config.machineId
  });

  if (params.daemon) {
    proc.unref();
  } else {
    proc.stdout?.on('data', () => {});
    proc.stderr?.on('data', () => {});

    proc.on('exit', async (code) => {
      runningProcesses.delete(processId);
      await db.updateServerInstance(processId, {
        status: 'stopped',
        stopped_at: new Date().toISOString()
      });
    });

    try {
      await waitForServerReady(proc);
    } catch (err) {
      runningProcesses.delete(processId);
      await db.updateServerInstance(processId, {
        status: 'stopped',
        stopped_at: new Date().toISOString()
      });
      throw err;
    }
  }

  return {
    processId,
    pid: proc.pid,
    config: params
  };
}

export async function stopServer() {
  const serverInstance = await db.getActiveServerInstance(config.machineId);

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
  const serverInstance = await db.getActiveServerInstance(config.machineId);

  if (!serverInstance) {
    return {
      running: false,
      machineId: config.machineId
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
    machineId: config.machineId
  };
}

function describeErrorStatus(code, raw, testType, hasValidData) {
  const msg = raw?.ErrorMessage ? raw.ErrorMessage.replace(/^ERROR:\s*/i, '').trim() : null;
  const msg2 = raw?.ErrorMessage2 ? raw.ErrorMessage2.replace(/^WARNING:\s*/i, '').trim() : null;
  const msg2Lower = (msg2 || '').toLowerCase();

  if (code === 200 && testType === 'downstream' && hasValidData) {
    if (msg2Lower.includes('incoming traffic has completely stopped')) {
      return 'Test completed successfully. Note: The connection warning after test completion is normal behavior for downstream tests.';
    }
  }

  if (msg && msg2) return `${msg}. ${msg2}`;
  if (msg) return msg;
  if (msg2) return msg2;

  const descriptions = {
    1: 'Test inconclusive — server could not determine IP-layer capacity.',
    2: 'Test inconclusive — server capacity undetermined. Ensure server is stable for the full test duration.',
    3: 'Minimum required connections unavailable. The server accepted the setup request but test data never arrived — this is usually a firewall issue. Ensure the backend machine can receive UDP traffic from the server on ephemeral ports 32768-60999. On the server run: sudo ufw allow 32768:60999/udp',
    4: 'Protocol version mismatch between client and server.',
    5: 'Authentication error — check that both client and server use the same authentication key.',
    200: hasValidData
      ? 'Test completed with connection warnings but collected valid data.'
      : 'Test failed — minimum required connections unavailable. Verify the server is running, reachable on UDP port 25000, and that ephemeral UDP ports 32768-60999 are not blocked by a firewall between the backend and the server.'
  };
  return descriptions[code] || `Test completed with error status ${code}. Check server logs for details.`;
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

  if (params.connections) {
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

  args.push('-f', 'json');

  args.push(...params.servers);

  const commandLine = `${config.udpst.binaryPath} ${args.join(' ')}`;
  logger.info('Spawning udpst client', { testId, command: commandLine, args });

  const proc = spawn(config.udpst.binaryPath, args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  runningProcesses.set(testId, {
    process: proc,
    type: 'client',
    startTime: new Date(),
    commandLine
  });

  await db.updateTest(testId, {
    status: 'running',
    pid: proc.pid,
    started_at: new Date().toISOString(),
    command_line: commandLine
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

    const hasOutput = stdoutData.trim().length > 0;

    logger.info('Test process exited', {
      testId,
      exitCode: code,
      hasStdout: hasOutput,
      stdoutPreview: stdoutData.substring(0, 300),
      stderrPreview: stderrData.substring(0, 300)
    });

    if (code === 0 || (code !== 0 && hasOutput)) {
      try {
        const results = parseUdpstOutput(stdoutData);
        const errorStatus = results.raw?.ErrorStatus;
        const errorMessage2 = results.raw?.ErrorMessage2;

        if (errorStatus && errorStatus !== 0) {
          const resultQuality = assessResultQuality(results, params.duration);
          const errorClassification = classifyErrorSeverity(
            errorStatus,
            errorMessage2,
            results,
            params.testType
          );

          const errorDesc = describeErrorStatus(
            errorStatus,
            results.raw,
            params.testType,
            results.hasValidData
          );

          logger.info('Test completed with ErrorStatus', {
            testId,
            errorStatus,
            exitCode: code,
            severity: errorClassification.severity,
            quality: resultQuality.quality,
            hasValidData: results.hasValidData,
            intervalCount: results.intervalCount
          });

          await db.saveTestResults(testId, results);

          if (errorClassification.severity === 'INFO' || errorClassification.severity === 'WARNING') {
            if (resultQuality.quality === 'COMPLETE' || resultQuality.quality === 'PARTIAL_GOOD') {
              await db.updateTest(testId, {
                status: 'completed_warnings',
                error_message: errorDesc,
                warning_messages: errorClassification.message,
                completed_at: completedAt
              });
              logger.info('Test marked as completed with warnings', { testId, quality: resultQuality.quality });
            } else {
              await db.updateTest(testId, {
                status: 'failed',
                error_message: errorDesc,
                completed_at: completedAt
              });
              logger.warn('Test marked as failed due to insufficient data', { testId, quality: resultQuality.quality });
            }
          } else {
            await db.updateTest(testId, {
              status: 'failed',
              error_message: errorDesc,
              completed_at: completedAt
            });
            logger.warn('Test marked as failed', { testId, severity: errorClassification.severity });
          }
        } else {
          logger.info('Test completed successfully', { testId, throughput: results.throughput });
          await db.saveTestResults(testId, results);
          await db.updateTest(testId, {
            status: 'completed',
            completed_at: completedAt
          });
        }
      } catch (parseError) {
        const errorMsg = stderrData.trim() || stdoutData.trim() || `Process exited with code ${code}`;
        logger.warn('Test failed - parse error', { testId, exitCode: code, error: parseError.message, errorMsg: errorMsg.substring(0, 200) });
        await db.updateTest(testId, {
          status: 'failed',
          error_message: errorMsg,
          completed_at: completedAt
        });
      }
    } else {
      const errorMsg = stderrData.trim() || `Process exited with code ${code}`;
      logger.warn('Test failed - no output', { testId, exitCode: code, error: errorMsg.substring(0, 200) });
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
    errorMessage: testWithResults.error_message,
    commandLine: testWithResults.command_line || null
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

export async function getServerConnections() {
  const activeTests = await db.getActiveTests();

  return activeTests.map(test => {
    const processInfo = runningProcesses.get(test.test_id);
    const elapsedSeconds = processInfo
      ? Math.floor((Date.now() - processInfo.startTime.getTime()) / 1000)
      : 0;
    const totalSeconds = test.config?.duration || 0;
    const progress = totalSeconds > 0
      ? Math.min(100, Math.floor((elapsedSeconds / totalSeconds) * 100))
      : 0;

    return {
      testId: test.test_id,
      servers: test.servers,
      testType: test.test_type,
      startedAt: test.started_at,
      duration: totalSeconds,
      elapsedSeconds,
      progress,
      pid: test.pid,
      config: test.config
    };
  });
}
