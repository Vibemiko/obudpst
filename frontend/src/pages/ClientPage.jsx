import { useState, useEffect } from 'react';
import { Play, StopCircle, Download, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

export default function ClientPage() {
  const [config, setConfig] = useState({
    testType: 'downstream',
    servers: '192.168.1.100',
    port: 25000,
    duration: 10,
    connections: 1,
    interface: '',
    ipVersion: 'ipv4',
    jumboFrames: true,
    bandwidth: 0,
    verbose: false
  });

  const [currentTest, setCurrentTest] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  async function handleStart() {
    setLoading(true);
    setError(null);
    setTestResults(null);

    try {
      const servers = config.servers.split(',').map(s => s.trim()).filter(s => s);

      const result = await api.client.start({
        ...config,
        servers
      });

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
              disabled={currentTest?.status === 'running'}
              options={[
                { value: 'upstream', label: 'Upstream' },
                { value: 'downstream', label: 'Downstream' }
              ]}
            />

            <Input
              label="Server Addresses"
              value={config.servers}
              onChange={(e) => setConfig({ ...config, servers: e.target.value })}
              placeholder="192.168.1.100 or multiple: 192.168.1.100, 192.168.1.101"
              required
              disabled={currentTest?.status === 'running'}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Port"
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                min={1}
                max={65535}
                disabled={currentTest?.status === 'running'}
              />

              <Input
                label="Duration (seconds)"
                type="number"
                value={config.duration}
                onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                min={5}
                max={3600}
                disabled={currentTest?.status === 'running'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Connections"
                type="number"
                value={config.connections}
                onChange={(e) => setConfig({ ...config, connections: parseInt(e.target.value) })}
                min={1}
                max={24}
                disabled={currentTest?.status === 'running'}
              />

              <Input
                label="Bandwidth (Mbps, 0 = unlimited)"
                type="number"
                value={config.bandwidth}
                onChange={(e) => setConfig({ ...config, bandwidth: parseInt(e.target.value) })}
                min={0}
                disabled={currentTest?.status === 'running'}
              />
            </div>

            <Select
              label="IP Version"
              value={config.ipVersion}
              onChange={(e) => setConfig({ ...config, ipVersion: e.target.value })}
              disabled={currentTest?.status === 'running'}
              options={[
                { value: 'ipv4', label: 'IPv4' },
                { value: 'ipv6', label: 'IPv6' }
              ]}
            />

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.jumboFrames}
                  onChange={(e) => setConfig({ ...config, jumboFrames: e.target.checked })}
                  disabled={currentTest?.status === 'running'}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enable jumbo frames</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.verbose}
                  onChange={(e) => setConfig({ ...config, verbose: e.target.checked })}
                  disabled={currentTest?.status === 'running'}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Verbose output</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              {currentTest?.status === 'running' ? (
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
                  disabled={loading}
                  className="flex-1"
                >
                  <Play size={20} className="inline mr-2" />
                  Start Test
                </Button>
              )}
            </div>
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

              {currentTest.status === 'running' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm text-gray-900">{currentTest.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${currentTest.progress}%` }}
                    />
                  </div>
                </>
              )}

              {testResults?.errorMessage && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm text-amber-800">{testResults.errorMessage}</p>
                </div>
              )}

              {testResults?.results && (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                  <ResultItem
                    icon={config.testType === 'downstream' ? <TrendingDown className="text-primary-600" /> : <TrendingUp className="text-primary-600" />}
                    label="Throughput"
                    value={`${testResults.results.throughput.toFixed(2)} Mbps`}
                  />

                  <ResultItem
                    label="Packet Loss"
                    value={`${testResults.results.packetLoss.toFixed(4)}%`}
                  />

                  <ResultItem
                    label="Latency"
                    value={`${testResults.results.latency.toFixed(2)} ms`}
                  />

                  <ResultItem
                    label="Jitter"
                    value={`${testResults.results.jitter.toFixed(2)} ms`}
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
