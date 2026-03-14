import { useState, useEffect, useRef } from 'react';
import { Power, PowerOff, CircleCheck as CheckCircle, Circle as XCircle, Wifi, Clock, ArrowDown, ArrowUp, Terminal } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import { api } from '../services/api';

export default function ServerPage() {
  const [serverStatus, setServerStatus] = useState(null);
  const [connections, setConnections] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [serverOutput, setServerOutput] = useState([]);
  const [outputSince, setOutputSince] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const outputRef = useRef(null);

  const [config, setConfig] = useState({
    port: 25000,
    ipVersion: 'ipv4',
    interface: '',
    daemon: false,
    authKey: '',
    mtuMode: 'default'
  });

  useEffect(() => {
    api.interfaces.list().then(data => {
      setInterfaces(data.interfaces || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (serverStatus?.running) {
      fetchOutput();
    }
  }, [serverStatus?.running]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [serverOutput]);

  async function fetchAll() {
    try {
      const [status, conns] = await Promise.all([
        api.server.getStatus(),
        api.server.getConnections().catch(() => ({ connections: [] }))
      ]);
      setServerStatus(status);
      setConnections(conns.connections || []);
    } catch (err) {
      console.error('Failed to fetch server status:', err);
    }
  }

  async function fetchOutput() {
    try {
      const data = await api.server.getOutput(outputSince);
      if (data.lines && data.lines.length > 0) {
        setServerOutput(prev => [...prev, ...data.lines]);
        setOutputSince(data.nextSince || outputSince + data.lines.length);
      }
    } catch (err) {
      console.error('Failed to fetch server output:', err);
    }
  }

  useEffect(() => {
    if (!serverStatus?.running) return;
    const interval = setInterval(fetchOutput, 1000);
    return () => clearInterval(interval);
  }, [serverStatus?.running, outputSince]);

  const filteredInterfaces = interfaces.filter(iface =>
    config.ipVersion === 'ipv6'
      ? iface.family === 'IPv6'
      : iface.family === 'IPv4'
  );

  function handleIPVersionChange(e) {
    setConfig({ ...config, ipVersion: e.target.value, interface: '' });
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    setServerOutput([]);
    setOutputSince(0);
    try {
      await api.server.start(config);
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    setError(null);
    try {
      await api.server.stop();
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const interfaceOptions = [
    { value: '', label: 'All interfaces' },
    ...filteredInterfaces.map(iface => ({
      value: iface.address,
      label: `${iface.name} — ${iface.address}`
    }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Server Control</h1>
          <p className="mt-2 text-gray-600">Manage OB-UDPST server instance and monitor active connections</p>
        </div>

        {serverStatus?.running && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold text-green-700">Server Live</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <XCircle className="text-red-500 mr-3 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Server Status">
          <div className="space-y-4">
            {serverStatus?.machineId && (
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md border border-gray-200">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Machine ID</span>
                <span className="text-xs font-mono text-gray-700">{serverStatus.machineId}</span>
              </div>
            )}

            {serverStatus?.running ? (
              <>
                <StatusRow label="Status">
                  <div className="flex items-center text-green-600">
                    <CheckCircle size={18} className="mr-1.5" />
                    <span className="font-semibold">Running</span>
                  </div>
                </StatusRow>
                <StatusRow label="PID">
                  <span className="font-mono text-sm text-gray-900">{serverStatus.pid}</span>
                </StatusRow>
                {serverStatus.uptime !== null && (
                  <StatusRow label="Uptime">
                    <span className="text-sm text-gray-900">{formatUptime(serverStatus.uptime)}</span>
                  </StatusRow>
                )}
                <StatusRow label="Port">
                  <span className="text-sm text-gray-900">{serverStatus.config?.port || 25000}</span>
                </StatusRow>
                {serverStatus.config?.ipVersion && (
                  <StatusRow label="IP Version">
                    <span className="text-sm font-semibold text-gray-900">
                      {serverStatus.config.ipVersion === 'ipv6' ? 'IPv6' : 'IPv4'}
                    </span>
                  </StatusRow>
                )}
                {serverStatus.config?.interface && (
                  <StatusRow label="Interface">
                    <span className="text-sm text-gray-900">{serverStatus.config.interface}</span>
                  </StatusRow>
                )}
                {serverStatus.config?.mtuMode && (
                  <StatusRow label="MTU Mode">
                    <span className="text-sm text-gray-900 capitalize">{serverStatus.config.mtuMode}</span>
                  </StatusRow>
                )}
                <StatusRow label="Active Connections">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                    {connections.length}
                  </span>
                </StatusRow>

                <Button variant="danger" onClick={handleStop} disabled={loading} className="w-full mt-2">
                  <PowerOff size={18} className="inline mr-2" />
                  Stop Server
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <XCircle size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">Server is not running</p>
                <p className="text-gray-400 text-sm mt-1">Configure and start the server below</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Server Configuration">
          <div className="space-y-4">
            <Input
              label="Control Port"
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
              min={1}
              max={65535}
              disabled={serverStatus?.running}
            />

            <Select
              label="IP Version"
              value={config.ipVersion}
              onChange={handleIPVersionChange}
              disabled={serverStatus?.running}
              options={[
                { value: 'ipv4', label: 'IPv4' },
                { value: 'ipv6', label: 'IPv6' }
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bind Interface
              </label>
              <select
                value={config.interface}
                onChange={(e) => setConfig({ ...config, interface: e.target.value })}
                disabled={serverStatus?.running}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                {interfaceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MTU Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'default', label: 'Default', desc: '1222 byte (-j)' },
                  { value: 'internet', label: 'Internet', desc: '1472 byte (-j -T)' },
                  { value: 'jumbo', label: 'Jumbo', desc: '8972 byte (none)' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfig({ ...config, mtuMode: opt.value })}
                    disabled={serverStatus?.running}
                    className={`px-2 py-2 text-xs rounded border text-left transition-colors ${
                      config.mtuMode === opt.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className={`mt-0.5 ${config.mtuMode === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Authentication Key"
              value={config.authKey}
              onChange={(e) => setConfig({ ...config, authKey: e.target.value })}
              placeholder="Optional"
              disabled={serverStatus?.running}
            />

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.daemon}
                  onChange={(e) => setConfig({ ...config, daemon: e.target.checked })}
                  disabled={serverStatus?.running}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Run as daemon</span>
              </label>
            </div>

            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Terminal size={12} />
              <span>Verbose output is always enabled for live log capture</span>
            </div>

            {!serverStatus?.running && (
              <Button
                variant="primary"
                onClick={handleStart}
                disabled={loading}
                className="w-full"
              >
                <Power size={18} className="inline mr-2" />
                Start Server
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card title="Active Client Connections">
        {connections.length === 0 ? (
          <div className="text-center py-10">
            <Wifi size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No active connections</p>
            <p className="text-gray-400 text-sm mt-1">
              {serverStatus?.running
                ? 'Waiting for clients to connect...'
                : 'Start the server to accept connections'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((conn) => (
              <ConnectionCard key={conn.testId} connection={conn} />
            ))}
          </div>
        )}
      </Card>

      {serverStatus?.running && (
        <Card title="Live Server Output">
          <div
            ref={outputRef}
            className="bg-gray-950 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs leading-5"
          >
            {serverOutput.length === 0 ? (
              <span className="text-gray-500">Waiting for output...</span>
            ) : (
              serverOutput.map((line, i) => (
                <div key={i} className="text-green-400 whitespace-pre-wrap break-all">{line}</div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function ConnectionCard({ connection }) {
  const { testId, servers, testType, elapsedSeconds, duration, progress, startedAt, subIntervals } = connection;

  const serverLabel = Array.isArray(servers) ? servers.join(', ') : String(servers || '');
  const shortId = testId ? testId.replace('test_', '') : 'unknown';

  const latestMbpsByConn = {};
  if (subIntervals?.intervals?.length > 0) {
    for (const si of subIntervals.intervals) {
      latestMbpsByConn[si.connId] = si.mbps;
    }
  }
  const connIds = Object.keys(latestMbpsByConn).map(Number);

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {testType === 'downstream' ? (
              <ArrowDown size={14} className="text-blue-500 flex-shrink-0" />
            ) : (
              <ArrowUp size={14} className="text-orange-500 flex-shrink-0" />
            )}
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {testType || 'unknown'}
            </span>
          </div>
          <p className="text-xs font-mono text-gray-600 truncate" title={serverLabel}>
            {serverLabel}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">
            ID: {shortId.slice(-10)}
          </p>
        </div>

        <div className="flex-shrink-0 ml-3">
          <DonutChart progress={progress} />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-400">Elapsed</p>
          <p className="text-sm font-semibold text-gray-700 tabular-nums">
            {formatDuration(elapsedSeconds)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Duration</p>
          <p className="text-sm font-semibold text-gray-700 tabular-nums">
            {duration ? `${duration}s` : '--'}
          </p>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span className="font-semibold text-gray-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {connIds.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-400 mb-2">Live Mbps per Connection</p>
          <div className="space-y-1">
            {connIds.map(id => (
              <div key={id} className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-mono">Conn {id}</span>
                <span className="text-xs font-semibold text-blue-600 tabular-nums">
                  {latestMbpsByConn[id].toFixed(1)} Mbps
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {startedAt && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <Clock size={10} />
          Started {formatRelativeTime(startedAt)}
        </p>
      )}
    </div>
  );
}

function DonutChart({ progress }) {
  const r = 20;
  const cx = 30;
  const cy = 30;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  const color = progress >= 80
    ? '#22c55e'
    : progress >= 40
    ? '#3b82f6'
    : '#94a3b8';

  return (
    <div className="relative w-[60px] h-[60px]">
      <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-gray-700 tabular-nums">{progress}%</span>
      </div>
    </div>
  );
}

function StatusRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
