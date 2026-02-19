import { spawn } from 'child_process';
import { createSocket } from 'dgram';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const CONTROL_PORT_TIMEOUT = 8000;
const PING_TIMEOUT = 2000;

export async function checkServerReachability(host, port = 25000) {
  const result = {
    host,
    port,
    reachable: false,
    pingSuccessful: false,
    controlPortOpen: false,
    checks: []
  };

  try {
    result.pingSuccessful = await pingHost(host);
    result.checks.push({
      name: 'Network Ping',
      passed: result.pingSuccessful,
      message: result.pingSuccessful ? `Host ${host} is reachable` : `Host ${host} is not reachable via ping`
    });
  } catch (err) {
    result.checks.push({
      name: 'Network Ping',
      passed: false,
      message: `Ping check failed: ${err.message}`
    });
  }

  try {
    result.controlPortOpen = await probeRemoteUDPPort(host, port);
    result.checks.push({
      name: 'UDP Port',
      passed: result.controlPortOpen,
      message: result.controlPortOpen
        ? `UDP port ${port} is responding on ${host} (UDPST server is running)`
        : `UDP port ${port} is not responding on ${host} (UDPST server may not be running)`
    });
  } catch (err) {
    result.checks.push({
      name: 'UDP Port',
      passed: false,
      message: `UDP port check failed: ${err.message}`
    });
  }

  result.reachable = result.pingSuccessful && result.controlPortOpen;

  if (!result.reachable) {
    const issues = [];
    if (!result.pingSuccessful) {
      issues.push('Host is not reachable on the network');
    }
    if (!result.controlPortOpen) {
      issues.push(`Control port ${port} is not accessible on remote host`);
    }
    result.error = issues.join('. ');
    result.recommendation = generateRecommendation(result);
  }

  logger.info('Server health check completed', {
    host,
    port,
    reachable: result.reachable,
    pingSuccessful: result.pingSuccessful,
    controlPortOpen: result.controlPortOpen
  });

  return result;
}

function pingHost(host) {
  return new Promise((resolve) => {
    const isIPv6 = host.includes(':');
    const args = isIPv6
      ? ['-6', '-c', '1', '-W', Math.ceil(PING_TIMEOUT / 1000).toString(), host]
      : ['-c', '1', '-W', Math.ceil(PING_TIMEOUT / 1000).toString(), host];

    const proc = spawn('ping', args, {
      stdio: 'pipe',
      timeout: PING_TIMEOUT + 500
    });

    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve(false);
      }
    }, PING_TIMEOUT + 500);

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(code === 0);
      }
    });

    proc.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(false);
      }
    });
  });
}

async function probeRemoteUDPPort(host, port) {
  const binaryProbe = await probeWithBinary(host, port);
  if (binaryProbe !== null) {
    return binaryProbe;
  }

  return probeWithDgram(host, port);
}

function probeWithBinary(host, port) {
  return new Promise((resolve) => {
    const binaryPath = config.udpst.binaryPath;
    if (!existsSync(binaryPath)) {
      resolve(null);
      return;
    }

    const isIPv6 = host.includes(':');
    const args = [
      isIPv6 ? '-6' : '-4',
      '-d',
      '-p', port.toString(),
      '-t', '5',
      '-f', 'json',
      host
    ];

    const proc = spawn(binaryPath, args, {
      stdio: 'pipe',
      timeout: CONTROL_PORT_TIMEOUT
    });

    let stdout = '';
    let resolved = false;

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (!resolved && (stdout.includes('"ErrorStatus"') || stdout.includes('"IncrementalResult"'))) {
        resolved = true;
        proc.kill();
        const errorMatch = stdout.match(/"ErrorStatus"\s*:\s*(\d+)/);
        if (errorMatch) {
          const errorStatus = parseInt(errorMatch[1]);
          resolve(errorStatus !== 4 && errorStatus !== 5);
        } else {
          resolve(true);
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      if (!resolved && (text.includes('Setup response') || text.includes('Connection created'))) {
        resolved = true;
        proc.kill();
        resolve(true);
      }
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        if (stdout.includes('"ErrorStatus"') || stdout.includes('"IncrementalResult"')) {
          resolve(true);
        } else {
          resolve(null);
        }
      }
    }, CONTROL_PORT_TIMEOUT);

    proc.on('exit', (code) => {
      clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        if (stdout.includes('"ErrorStatus"') || stdout.includes('"IncrementalResult"')) {
          const errorMatch = stdout.match(/"ErrorStatus"\s*:\s*(\d+)/);
          if (errorMatch) {
            const errorStatus = parseInt(errorMatch[1]);
            resolve(errorStatus !== 4 && errorStatus !== 5);
          } else {
            resolve(true);
          }
        } else {
          resolve(code === 0);
        }
      }
    });

    proc.on('error', () => {
      clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });
}

function probeWithDgram(host, port) {
  return new Promise((resolve) => {
    const isIPv6 = host.includes(':');
    const socketType = isIPv6 ? 'udp6' : 'udp4';

    let resolved = false;
    let socket;

    try {
      socket = createSocket(socketType);
    } catch (_) {
      resolve(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { socket.close(); } catch (_) {}
        resolve(false);
      }
    }, CONTROL_PORT_TIMEOUT);

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        try { socket.close(); } catch (_) {}
        resolve(false);
      }
    });

    socket.on('message', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        try { socket.close(); } catch (_) {}
        resolve(true);
      }
    });

    const testPayload = Buffer.alloc(16, 0);
    socket.send(testPayload, 0, testPayload.length, port, host, (err) => {
      if (err && !resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        try { socket.close(); } catch (_) {}
        resolve(false);
      }
    });
  });
}

function generateRecommendation(result) {
  const recommendations = [];

  if (!result.pingSuccessful) {
    recommendations.push(
      `The server at ${result.host} is not reachable. ` +
      'Verify the IP address is correct and the server machine is powered on. ' +
      'Check network connectivity between this machine and the server.'
    );
  }

  if (!result.controlPortOpen) {
    recommendations.push(
      `UDP port ${result.port} is not responding on ${result.host}. ` +
      'Ensure the UDPST server is running on that machine. ' +
      `Start the server with: udpst -4 -x ${result.host} (for IPv4) or udpst -6 -x ${result.host} (for IPv6). ` +
      `Also check firewall rules to allow incoming UDP traffic on port ${result.port}.`
    );
  }

  return recommendations.join(' ');
}

export async function checkMultipleServers(servers, port = 25000) {
  const results = await Promise.all(
    servers.map(server => checkServerReachability(server, port))
  );

  const allReachable = results.every(r => r.reachable);
  const summary = {
    allReachable,
    totalServers: servers.length,
    reachableServers: results.filter(r => r.reachable).length,
    unreachableServers: results.filter(r => !r.reachable).length,
    servers: results
  };

  return summary;
}
