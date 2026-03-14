import { useState, useEffect } from 'react';
import { Play, CircleStop as StopCircle, Download, TrendingUp, TrendingDown, CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, Terminal, Copy, Check, Info } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import StatusBadge from '../components/StatusBadge';
import ServerHealthCheck from '../components/ServerHealthCheck';
import { api } from '../services/api';
import { validateIPList, validateSingleIP } from '../utils/validation';

export default function ClientPage() {
  const [config, setConfig] = useState({
    testType: 'downstream',
    servers: '',
    port: 25000,
    duration: 10,
    connections: 2,
    interface: '',
    ipVersion: 'ipv4',
    mtuMode: 'default',
    bandwidth: 0,
    rateIndex: '',
    authKey: ''
  });

  const [interfaces, setInterfaces] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [serversError, setServersError] = useState(null);
  const [healthCheckResult, setHealthCheckResult] = useState(null);
  const [showBandwidthTip, setShowBandwidthTip] = useState(false);

  useEffect(() => {
    api.interfaces.list().then(r => setInterfaces(r.interfaces || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentTest?.testId && currentTest?.status === 'running') {
      const interval = setInterval(() => pollTestStatus(), 1000);
      return () => clearInterval(interval);
    }
  }, [currentTest]);

  async function pollTestStatus() {
    try {
      const status = await api.test.getStatus(currentTest.testId);

      if (status.status !== 'running') {
        const results = await api.test.getResults(currentTest.testId);
        setTestResults(results);
        setCurrentTest(prev => ({ ...prev, status: status.status }));
      } else {
        setCurrentTest(prev => ({ ...prev, ...status }));
      }
    } catch (err) {
      console.error('Failed to poll test status:', err);
    }
  }

  function handleIPVersionChange(e) {
    const newVersion = e.target.value;
    setConfig({ ...config, ipVersion: newVersion, servers: '', interface: '' });
    setServersError(null);
  }

  function handleServersChange(e) {
    const val = e.target.value;
    setConfig({ ...config, servers: val });
    setServersError(validateIPList(val, config.ipVersion));
    setHealthCheckResult(null);
  }

  const isStartDisabled = loading || !!serversError || !config.servers.trim();

  async function handleStart() {
    setLoading(true);
    setError(null);
    setTestResults(null);

    try {
      const servers = config.servers.split(',').map(s => s.trim()).filter(s => s);

      const params = {
        testType: config.testType,
        servers,
        port: config.port,
        duration: config.duration,
        connections: config.connections,
        interface: config.interface,
        ipVersion: config.ipVersion,
        mtuMode: config.mtuMode,
        bandwidth: config.bandwidth,
        authKey: config.authKey || undefined
      };

      if (config.rateIndex !== '') {
        params.rateIndex = config.rateIndex;
      }

      const result = await api.client.start(params);

      setCurrentTest({
        testId: result.testId,
        status: result.status,
        progress: 0
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!currentTest?.testId) return;

    try {
      await api.test.stop(currentTest.testId);
      setCurrentTest(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCopyCommand() {
    if (!testResults?.commandLine) return;
    navigator.clipboard.writeText(testResults.commandLine).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleExportResults() {
    if (!testResults?.rawOutput) return;

    const dataStr = JSON.stringify(testResults.rawOutput, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `udpst-${testResults.testId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const isRunning = currentTest?.status === 'running';
  const ipVersionLabel = config.ipVersion === 'ipv6' ? 'IPv6' : 'IPv4';
  const serversPlaceholder = config.ipVersion === 'ipv6'
    ? 'e.g. 2001:db8::1 or multiple: 2001:db8::1, 2001:db8::2'
    : 'e.g. 192.168.1.100 or multiple: 192.168.1.100, 192.168.1.101';

  const testFailed = testResults?.status === 'failed' || (testResults?.errorMessage && !testResults?.results);
  const testCompletedWithWarnings = testResults?.status === 'completed_warnings';
  const testCompletedPartial = testResults?.status === 'completed_partial';
  const showResults = testResults?.results && (testResults?.status === 'completed' || testCompletedWithWarnings || testCompletedPartial);

  const filteredInterfaces = interfaces.filter(i =>
    config.ipVersion === 'ipv6' ? i.family === 'IPv6' : i.family === 'IPv4'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Client Test</h1>
        <p className="mt-2 text-gray-600">
          Configure and execute UDP speed tests
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Test Configuration">
          <div className="space-y-4">
            <Select
              label="Test Type"
              value={config.testType}
              onChange={(e) => setConfig({ ...config, testType: e.target.value })}
              disabled={isRunning}
              options={[
                { value: 'upstream', label: 'Upstream' },
                { value: 'downstream', label: 'Downstream' }
              ]}
            />

            <Select
              label="IP Version"
              value={config.ipVersion}
              onChange={handleIPVersionChange}
              disabled={isRunning}
              options={[
                { value: 'ipv4', label: 'IPv4' },
                { value: 'ipv6', label: 'IPv6' }
              ]}
            />

            <div>
              <Input
                label={`Server ${ipVersionLabel} Addresses`}
                value={config.servers}
                onChange={handleServersChange}
                placeholder={serversPlaceholder}
                required
                disabled={isRunning}
              />
              {serversError && (
                <p className="mt-1 text-xs text-red-600">{serversError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Port"
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                min={1}
                max={65535}
                disabled={isRunning}
              />

              <Input
                label="Duration (seconds)"
                type="number"
                value={config.duration}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                min={5}
                max={3600}
                disabled={isRunning}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  label="Connections"
                  type="number"
                  value={config.connections}
                  onChange={(e) => setConfig({ ...config, connections: parseInt(e.target.value) })}
                  min={1}
                  max={24}
                  disabled={isRunning}
                />
                <p className="text-xs text-gray-500 mt-1">2+ connections recommended</p>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="block text-sm font-medium text-gray-700">Bandwidth (Mbps)</label>
                  <button
                    type="button"
                    onClick={() => setShowBandwidthTip(v => !v)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Info size={14} />
                  </button>
                </div>
                {showBandwidthTip && (
                  <div className="mb-2 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1.5 text-blue-800">
                    <strong>Search Mode (-B)</strong>: This sets the <em>starting</em> search rate, not a cap. UDPST will dynamically probe upward to find the true capacity. Set to 0 for automatic starting point.
                  </div>
                )}
                <Input
                  type="number"
                  value={config.bandwidth}
                  onChange={(e) => setConfig({ ...config, bandwidth: parseInt(e.target.value) })}
                  min={0}
                  disabled={isRunning}
                  placeholder="0 = auto"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sending Rate Index (-I)</label>
              <div className="grid grid-cols-3 gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, rateIndex: '' })}
                  disabled={isRunning}
                  className={`px-2 py-1.5 text-xs rounded border transition-colors ${config.rateIndex === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, rateIndex: '@' })}
                  disabled={isRunning}
                  className={`px-2 py-1.5 text-xs rounded border transition-colors ${config.rateIndex.startsWith('@') && config.rateIndex !== '@0' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  Dynamic
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, rateIndex: '1' })}
                  disabled={isRunning}
                  className={`px-2 py-1.5 text-xs rounded border transition-colors ${config.rateIndex !== '' && !config.rateIndex.startsWith('@') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  Fixed
                </button>
              </div>
              {config.rateIndex !== '' && (
                <Input
                  value={config.rateIndex}
                  onChange={(e) => setConfig({ ...config, rateIndex: e.target.value })}
                  placeholder={config.rateIndex.startsWith('@') ? '@X (dynamic start, e.g. @50)' : 'X (fixed index, e.g. 100)'}
                  disabled={isRunning}
                />
              )}
              <p className="text-xs text-gray-500 mt-1">Auto = -I @0, Dynamic = -I @X (start index), Fixed = -I X (exact row)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bind Interface</label>
              <select
                value={config.interface}
                onChange={(e) => setConfig({ ...config, interface: e.target.value })}
                disabled={isRunning}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Any interface</option>
                {filteredInterfaces.map(i => (
                  <option key={`${i.name}-${i.address}`} value={i.address}>
                    {i.name} — {i.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MTU Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'default', label: 'Default', desc: '1222 byte payload (-j)' },
                  { value: 'internet', label: 'Internet', desc: '1472 byte payload (-j -T)' },
                  { value: 'jumbo', label: 'Jumbo', desc: '8972 byte payload (no flags)' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfig({ ...config, mtuMode: opt.value })}
                    disabled={isRunning}
                    className={`px-2 py-2 text-xs rounded border text-left transition-colors ${config.mtuMode === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className={`mt-0.5 ${config.mtuMode === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Input
                label="Auth Key (optional)"
                type="password"
                value={config.authKey}
                onChange={(e) => setConfig({ ...config, authKey: e.target.value })}
                placeholder="Leave blank if server has no key"
                disabled={isRunning}
              />
            </div>

            <div className="flex gap-2 pt-2">
              {isRunning ? (
                <Button
                  variant="danger"
                  onClick={handleStop}
                  className="flex-1"
                >
                  <StopCircle size={20} className="inline mr-2" />
                  Stop Test
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleStart}
                  disabled={isStartDisabled}
                  className="flex-1"
                >
                  <Play size={20} className="inline mr-2" />
                  Start Test
                </Button>
              )}
            </div>

            {!isRunning && config.servers.trim() && (
              <ServerHealthCheck
                servers={config.servers}
                port={config.port}
                onCheckComplete={setHealthCheckResult}
              />
            )}
          </div>
        </Card>

        <Card title="Test Status & Results">
          {currentTest ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Test ID</span>
                <span className="text-sm font-mono text-gray-900">{currentTest.testId}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Status</span>
                <StatusBadge status={currentTest.status} />
              </div>

              {isRunning && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm text-gray-900">{currentTest.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentTest.progress}%` }}
                    />
                  </div>
                </>
              )}

              {testFailed && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900 mb-1">Test Failed</p>
                      <p className="text-sm text-red-800">
                        {testResults.errorMessage || 'Test failed. Check server connectivity and configuration.'}
                      </p>
                    </div>
                  </div>
                  {testResults.errorMessage?.includes('authentication') && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs text-red-700">Verify the auth key matches the server configuration.</p>
                    </div>
                  )}
                </div>
              )}

              {testCompletedWithWarnings && testResults?.errorMessage && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 mb-1">Test Completed with Warnings</p>
                      <p className="text-sm text-amber-800">{testResults.errorMessage}</p>
                      {config.testType === 'downstream' && (
                        <p className="text-xs text-amber-700 mt-2">
                          Note: Connection warnings after downstream test completion are normal behavior.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {testCompletedPartial && testResults?.errorMessage && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-900 mb-1">Partial Results Collected</p>
                      <p className="text-sm text-orange-800">{testResults.errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {showResults && (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                  <ResultItem
                    icon={config.testType === 'downstream' ? <TrendingDown className="text-blue-600" /> : <TrendingUp className="text-blue-600" />}
                    label="Throughput (IP Layer)"
                    value={formatMetric(testResults.results.throughput, 2, 'Mbps')}
                  />

                  <ResultItem
                    label="Packet Loss"
                    value={formatMetric(testResults.results.packetLoss, 2, '%')}
                  />

                  <ResultItem
                    label="Latency (RTT Range)"
                    value={formatMetric(testResults.results.latency, 3, 'ms')}
                  />

                  <ResultItem
                    label="Jitter (PDV Avg)"
                    value={formatMetric(testResults.results.jitter, 3, 'ms')}
                  />

                  <Button
                    variant="secondary"
                    onClick={handleExportResults}
                    className="w-full mt-4"
                  >
                    <Download size={20} className="inline mr-2" />
                    Export Results
                  </Button>
                </div>
              )}

              {testResults?.commandLine && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <Terminal size={13} />
                      Command Run
                    </div>
                    <button
                      onClick={handleCopyCommand}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-gray-700 whitespace-pre-wrap break-all leading-relaxed">
                    {testResults.commandLine}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Play size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Configure test parameters and click Start Test</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatMetric(value, decimals, unit) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return `${parseFloat(value).toFixed(decimals)} ${unit}`;
}

function ResultItem({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {icon && <span className="mr-2">{icon}</span>}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
