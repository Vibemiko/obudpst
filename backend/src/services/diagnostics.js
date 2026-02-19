import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';

function runCommand(cmd, args = [], timeoutMs = 3000) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: 'pipe',
      timeout: timeoutMs
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Command timeout', stdout, stderr });
    }, timeoutMs);

    proc.on('exit', (code) => {
      clearTimeout(timeoutId);
      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({ success: false, error: error.message, stdout, stderr });
    });
  });
}

export async function getSystemNetworkConfig() {
  const config = {
    ephemeralPorts: null,
    socketBuffers: { rmem_max: null, wmem_max: null },
    udpConntrack: { timeout: null, timeout_stream: null },
    firewallRules: [],
    warnings: []
  };

  const portRangeResult = await runCommand('sysctl', ['net.ipv4.ip_local_port_range']);
  if (portRangeResult.success) {
    const match = portRangeResult.stdout.match(/=\s*(\d+)\s+(\d+)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      config.ephemeralPorts = { start, end, count: end - start + 1 };

      if (start > 32768 || end < 60999) {
        config.warnings.push({
          category: 'ephemeral_ports',
          severity: 'MEDIUM',
          message: `Ephemeral port range ${start}-${end} may not cover the recommended range 32768-60999 for UDPST`,
          recommendation: 'Consider expanding the ephemeral port range with: sudo sysctl -w net.ipv4.ip_local_port_range="32768 60999"'
        });
      }
    }
  }

  const rmemResult = await runCommand('sysctl', ['net.core.rmem_max']);
  if (rmemResult.success) {
    const match = rmemResult.stdout.match(/=\s*(\d+)/);
    if (match) {
      config.socketBuffers.rmem_max = parseInt(match[1]);
      if (config.socketBuffers.rmem_max < 2097152) {
        config.warnings.push({
          category: 'socket_buffers',
          severity: 'HIGH',
          message: `Receive buffer size ${config.socketBuffers.rmem_max} is below UDPST requirement of 2MB`,
          recommendation: 'Increase with: sudo sysctl -w net.core.rmem_max=134217728'
        });
      }
    }
  }

  const wmemResult = await runCommand('sysctl', ['net.core.wmem_max']);
  if (wmemResult.success) {
    const match = wmemResult.stdout.match(/=\s*(\d+)/);
    if (match) {
      config.socketBuffers.wmem_max = parseInt(match[1]);
      if (config.socketBuffers.wmem_max < 2097152) {
        config.warnings.push({
          category: 'socket_buffers',
          severity: 'HIGH',
          message: `Send buffer size ${config.socketBuffers.wmem_max} is below UDPST requirement of 2MB`,
          recommendation: 'Increase with: sudo sysctl -w net.core.wmem_max=134217728'
        });
      }
    }
  }

  const conntrackResult = await runCommand('sysctl', ['net.netfilter.nf_conntrack_udp_timeout']);
  if (conntrackResult.success) {
    const match = conntrackResult.stdout.match(/=\s*(\d+)/);
    if (match) {
      config.udpConntrack.timeout = parseInt(match[1]);
      if (config.udpConntrack.timeout < 30) {
        config.warnings.push({
          category: 'conntrack',
          severity: 'LOW',
          message: `UDP conntrack timeout ${config.udpConntrack.timeout}s is low`,
          recommendation: 'Consider increasing to 30s or higher'
        });
      }
    }
  }

  const conntrackStreamResult = await runCommand('sysctl', ['net.netfilter.nf_conntrack_udp_timeout_stream']);
  if (conntrackStreamResult.success) {
    const match = conntrackStreamResult.stdout.match(/=\s*(\d+)/);
    if (match) {
      config.udpConntrack.timeout_stream = parseInt(match[1]);
    }
  }

  const iptablesResult = await runCommand('iptables', ['-L', '-n', '-v']);
  if (iptablesResult.success) {
    const udpRules = iptablesResult.stdout.split('\n').filter(line =>
      line.toLowerCase().includes('udp')
    );
    config.firewallRules = udpRules.slice(0, 20);
  }

  return config;
}

export async function getUDPConnectionTracking() {
  const tracking = {
    active_connections: [],
    total_udp: 0,
    udpst_related: 0
  };

  const conntrackResult = await runCommand('conntrack', ['-L', '-p', 'udp'], 5000);
  if (conntrackResult.success) {
    const lines = conntrackResult.stdout.split('\n').filter(l => l.trim());
    tracking.total_udp = lines.length;

    for (const line of lines.slice(0, 50)) {
      if (line.includes('dport=25000') || line.includes('sport=25000')) {
        tracking.udpst_related++;
        tracking.active_connections.push(line.trim());
      }
    }
  }

  return tracking;
}

export async function testEphemeralPortConnectivity(targetHost, targetPort = 25000) {
  const result = {
    tested: false,
    canConnect: false,
    localPort: null,
    error: null
  };

  const dgram = await import('dgram');

  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
      result.error = err.message;
      socket.close();
      resolve(result);
    });

    socket.bind(0, () => {
      const addr = socket.address();
      result.localPort = addr.port;
      result.tested = true;

      const testMessage = Buffer.from('TEST');
      socket.send(testMessage, targetPort, targetHost, (err) => {
        result.canConnect = !err;
        if (err) result.error = err.message;
        socket.close();
        resolve(result);
      });
    });

    setTimeout(() => {
      if (!result.tested) {
        result.error = 'Bind timeout';
        socket.close();
        resolve(result);
      }
    }, 2000);
  });
}

export async function getFirewallStatus() {
  const status = {
    ufw: { enabled: false, rules: [] },
    iptables: { hasRules: false, udpRules: [] }
  };

  const ufwResult = await runCommand('ufw', ['status', 'verbose']);
  if (ufwResult.success) {
    status.ufw.enabled = ufwResult.stdout.toLowerCase().includes('status: active');
    status.ufw.rules = ufwResult.stdout.split('\n').filter(line =>
      line.includes('ALLOW') || line.includes('DENY') || line.includes('REJECT')
    );
  }

  const iptablesResult = await runCommand('iptables', ['-L', '-n', '-v']);
  if (iptablesResult.success) {
    status.iptables.hasRules = iptablesResult.stdout.split('\n').length > 10;
    status.iptables.udpRules = iptablesResult.stdout.split('\n')
      .filter(line => line.toLowerCase().includes('udp'))
      .slice(0, 20);
  }

  return status;
}

export async function runQuickTest(targetServer, port = 25000, binaryPath) {
  const result = {
    success: false,
    duration: 2,
    throughput: null,
    intervals_collected: 0,
    error: null,
    raw_output: ''
  };

  if (!existsSync(binaryPath)) {
    result.error = 'UDPST binary not found';
    return result;
  }

  return new Promise((resolve) => {
    const args = ['-d', '-p', port.toString(), '-t', '2', '-f', 'json', targetServer];
    const proc = spawn(binaryPath, args, {
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      result.error = 'Test timeout (5s)';
      resolve(result);
    }, 5000);

    proc.on('exit', (code) => {
      clearTimeout(timeoutId);
      result.raw_output = stdout || stderr;

      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          result.success = true;
          result.throughput = parseFloat(data.IPLayerCapacity || data.AvgRate || 0);

          if (data.IncrementalResult && Array.isArray(data.IncrementalResult)) {
            result.intervals_collected = data.IncrementalResult.length;
          }
        } else {
          result.error = 'No JSON output from UDPST';
        }
      } catch (err) {
        result.error = `Parse error: ${err.message}`;
      }

      resolve(result);
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      result.error = err.message;
      resolve(result);
    });
  });
}

export async function getCompleteDiagnostics(targetServer, binaryPath) {
  logger.info('Running complete diagnostics', { targetServer });

  const diagnostics = {
    timestamp: new Date().toISOString(),
    targetServer,
    systemConfig: null,
    firewall: null,
    connectionTracking: null,
    ephemeralPortTest: null,
    quickTest: null,
    overallStatus: 'UNKNOWN',
    criticalIssues: [],
    recommendations: []
  };

  try {
    diagnostics.systemConfig = await getSystemNetworkConfig();
    diagnostics.firewall = await getFirewallStatus();
    diagnostics.connectionTracking = await getUDPConnectionTracking();
    diagnostics.ephemeralPortTest = await testEphemeralPortConnectivity(targetServer);
    diagnostics.quickTest = await runQuickTest(targetServer, 25000, binaryPath);

    if (diagnostics.systemConfig.warnings.length > 0) {
      diagnostics.systemConfig.warnings.forEach(w => {
        if (w.severity === 'HIGH') {
          diagnostics.criticalIssues.push(w.message);
          diagnostics.recommendations.push(w.recommendation);
        }
      });
    }

    if (!diagnostics.quickTest.success) {
      diagnostics.criticalIssues.push(`Quick test failed: ${diagnostics.quickTest.error || 'Unknown error'}`);
      diagnostics.recommendations.push('Verify UDPST server is running and network connectivity is working');
    }

    if (diagnostics.criticalIssues.length === 0 && diagnostics.quickTest.success) {
      diagnostics.overallStatus = 'HEALTHY';
    } else if (diagnostics.criticalIssues.length > 0) {
      diagnostics.overallStatus = 'CRITICAL';
    } else {
      diagnostics.overallStatus = 'WARNING';
    }

  } catch (error) {
    diagnostics.error = error.message;
    diagnostics.overallStatus = 'ERROR';
  }

  logger.info('Diagnostics completed', { status: diagnostics.overallStatus, issues: diagnostics.criticalIssues.length });

  return diagnostics;
}
