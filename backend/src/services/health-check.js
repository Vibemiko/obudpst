import { spawn } from 'child_process';
import dgram from 'dgram';
import net from 'net';
import { logger } from '../utils/logger.js';

const CONTROL_PORT_TIMEOUT = 3000;
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
    result.controlPortOpen = await checkTCPPort(host, port);
    result.checks.push({
      name: 'Control Port',
      passed: result.controlPortOpen,
      message: result.controlPortOpen
        ? `Port ${port} is open and accepting connections`
        : `Port ${port} is closed or not accepting connections`
    });
  } catch (err) {
    result.checks.push({
      name: 'Control Port',
      passed: false,
      message: `Port check failed: ${err.message}`
    });
  }

  result.reachable = result.pingSuccessful && result.controlPortOpen;

  if (!result.reachable) {
    const issues = [];
    if (!result.pingSuccessful) {
      issues.push('Host is not reachable on the network');
    }
    if (!result.controlPortOpen) {
      issues.push(`Control port ${port} is not accessible`);
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
    const pingCmd = isIPv6 ? 'ping6' : 'ping';
    const args = process.platform === 'win32'
      ? ['-n', '1', '-w', PING_TIMEOUT.toString(), host]
      : ['-c', '1', '-W', Math.ceil(PING_TIMEOUT / 1000).toString(), host];

    const proc = spawn(pingCmd, args, {
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

function checkTCPPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    }, CONTROL_PORT_TIMEOUT);

    socket.setTimeout(CONTROL_PORT_TIMEOUT);

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(false);
      }
    }
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
      `Port ${result.port} is not accessible on ${result.host}. ` +
      'Ensure the UDPST server is running on that machine. ' +
      `Start the server with: udpst -4 -x ${result.host} (for IPv4) or udpst -6 -x ${result.host} (for IPv6). ` +
      `Also check firewall rules to allow incoming connections on port ${result.port}.`
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
