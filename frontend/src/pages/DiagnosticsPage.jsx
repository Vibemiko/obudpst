import { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import StatusBadge from '../components/StatusBadge';
import { Activity, AlertTriangle, CheckCircle, Server, Network, Shield, Zap } from 'lucide-react';
import { api } from '../services/api';

export function DiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [binaryInfo, setBinaryInfo] = useState(null);
  const [systemConfig, setSystemConfig] = useState(null);
  const [firewall, setFirewall] = useState(null);
  const [connectionTracking, setConnectionTracking] = useState(null);
  const [quickTestResult, setQuickTestResult] = useState(null);
  const [completeDiagnostics, setCompleteDiagnostics] = useState(null);
  const [targetServer, setTargetServer] = useState('');
  const [activeTab, setActiveTab] = useState('binary');

  useEffect(() => {
    loadBinaryInfo();
    loadSystemConfig();
  }, []);

  const loadBinaryInfo = async () => {
    try {
      const data = await api.binary.getInfo();
      setBinaryInfo(data);
    } catch (error) {
      console.error('Failed to load binary info:', error);
    }
  };

  const loadSystemConfig = async () => {
    try {
      const data = await api.diagnostics.getSystem();
      setSystemConfig(data.systemConfig);
      setFirewall(data.firewall);
    } catch (error) {
      console.error('Failed to load system config:', error);
    }
  };

  const loadConnectionTracking = async () => {
    try {
      const data = await api.diagnostics.getConnections();
      setConnectionTracking(data);
    } catch (error) {
      console.error('Failed to load connection tracking:', error);
    }
  };

  const runQuickTest = async () => {
    if (!targetServer.trim()) return;

    setLoading(true);
    setQuickTestResult(null);

    try {
      const data = await api.diagnostics.runQuickTest({
        server: targetServer.trim(),
        port: 25000
      });
      setQuickTestResult(data.test);
    } catch (error) {
      console.error('Quick test failed:', error);
      setQuickTestResult({
        success: false,
        error: error.message || 'Test failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const runCompleteDiagnostics = async () => {
    if (!targetServer.trim()) return;

    setLoading(true);
    setCompleteDiagnostics(null);

    try {
      const data = await api.diagnostics.runComplete({
        server: targetServer.trim()
      });
      setCompleteDiagnostics(data.diagnostics);
    } catch (error) {
      console.error('Complete diagnostics failed:', error);
      setCompleteDiagnostics({
        overallStatus: 'ERROR',
        error: error.message || 'Diagnostics failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'HIGH': return 'text-red-600 bg-red-50';
      case 'MEDIUM': return 'text-orange-600 bg-orange-50';
      case 'LOW': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Diagnostics</h1>
        <p className="mt-2 text-gray-600">
          Troubleshoot UDPST connectivity and configuration issues
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'binary', label: 'Binary Info', icon: Server },
            { id: 'system', label: 'System Config', icon: Network },
            { id: 'firewall', label: 'Firewall', icon: Shield },
            { id: 'test', label: 'Quick Test', icon: Zap }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'binary' && binaryInfo && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Server className="w-6 h-6 text-blue-600" />
                UDPST Binary Information
              </h2>
              <StatusBadge status={binaryInfo.available ? 'running' : 'stopped'}>
                {binaryInfo.available ? 'Available' : 'Not Available'}
              </StatusBadge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Path</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{binaryInfo.path}</p>
                </div>
                {binaryInfo.version && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Version</label>
                      <p className="mt-1 text-sm text-gray-900">{binaryInfo.version.version || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Build Date</label>
                      <p className="mt-1 text-sm text-gray-900">{binaryInfo.version.buildDate || 'Unknown'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Protocol Version</label>
                      <p className="mt-1 text-sm text-gray-900">{binaryInfo.version.protocolVersion || 'Unknown'}</p>
                    </div>
                  </>
                )}
              </div>

              {binaryInfo.version?.optimizations && binaryInfo.version.optimizations.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Optimizations</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {binaryInfo.version.optimizations.map(opt => (
                      <span key={opt} className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-full">
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {binaryInfo.version?.warnings && binaryInfo.version.warnings.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Warnings
                  </h3>
                  <div className="space-y-3">
                    {binaryInfo.version.warnings.map((warning, idx) => (
                      <div key={idx} className={`p-4 rounded-lg ${getSeverityColor(warning.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium">{warning.message}</p>
                          <span className="text-xs uppercase font-semibold">{warning.severity}</span>
                        </div>
                        <p className="text-sm mt-2">{warning.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'system' && systemConfig && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Network className="w-6 h-6 text-blue-600" />
              Network Configuration
            </h2>

            <div className="space-y-6">
              {systemConfig.ephemeralPorts && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Ephemeral Port Range</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-mono">{systemConfig.ephemeralPorts.start} - {systemConfig.ephemeralPorts.end}</span>
                      {' '}({systemConfig.ephemeralPorts.count.toLocaleString()} ports available)
                    </p>
                  </div>
                </div>
              )}

              {systemConfig.socketBuffers && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Socket Buffers</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs text-gray-600">Receive Buffer (rmem_max)</label>
                      <p className="mt-1 text-sm font-mono">
                        {systemConfig.socketBuffers.rmem_max
                          ? `${(systemConfig.socketBuffers.rmem_max / 1024 / 1024).toFixed(0)} MB`
                          : 'Unknown'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs text-gray-600">Send Buffer (wmem_max)</label>
                      <p className="mt-1 text-sm font-mono">
                        {systemConfig.socketBuffers.wmem_max
                          ? `${(systemConfig.socketBuffers.wmem_max / 1024 / 1024).toFixed(0)} MB`
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {systemConfig.udpConntrack && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">UDP Connection Tracking</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs text-gray-600">Timeout</label>
                      <p className="mt-1 text-sm font-mono">{systemConfig.udpConntrack.timeout}s</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="text-xs text-gray-600">Stream Timeout</label>
                      <p className="mt-1 text-sm font-mono">{systemConfig.udpConntrack.timeout_stream}s</p>
                    </div>
                  </div>
                </div>
              )}

              {systemConfig.warnings && systemConfig.warnings.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Configuration Warnings
                  </h3>
                  <div className="space-y-3">
                    {systemConfig.warnings.map((warning, idx) => (
                      <div key={idx} className={`p-4 rounded-lg ${getSeverityColor(warning.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium">{warning.message}</p>
                          <span className="text-xs uppercase font-semibold">{warning.severity}</span>
                        </div>
                        <p className="text-sm mt-2">{warning.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Button onClick={loadConnectionTracking} variant="secondary" disabled={loading}>
            <Activity className="w-4 h-4 mr-2" />
            Load Connection Tracking
          </Button>

          {connectionTracking && (
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Active UDP Connections</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="text-xs text-gray-600">Total UDP Connections</label>
                    <p className="mt-1 text-2xl font-bold">{connectionTracking.total_udp}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="text-xs text-gray-600">UDPST Related (port 25000)</label>
                    <p className="mt-1 text-2xl font-bold">{connectionTracking.udpst_related}</p>
                  </div>
                </div>
                {connectionTracking.active_connections.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">Active UDPST Connections</label>
                    <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                      <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                        {connectionTracking.active_connections.join('\n')}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'firewall' && firewall && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Firewall Status
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">UFW (Uncomplicated Firewall)</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-700">Status</span>
                  <StatusBadge status={firewall.ufw.enabled ? 'running' : 'stopped'}>
                    {firewall.ufw.enabled ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
                {firewall.ufw.rules.length > 0 && (
                  <div className="mt-4">
                    <label className="text-xs text-gray-600 mb-2 block">Active Rules</label>
                    <div className="bg-white p-3 rounded border border-gray-200 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                        {firewall.ufw.rules.join('\n')}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">iptables UDP Rules</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                {firewall.iptables.udpRules.length > 0 ? (
                  <div className="bg-white p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                      {firewall.iptables.udpRules.join('\n')}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No UDP-specific rules found</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'test' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" />
              Quick Connectivity Test
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Server
                </label>
                <Input
                  value={targetServer}
                  onChange={(e) => setTargetServer(e.target.value)}
                  placeholder="Enter server IP or hostname"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the IP address or hostname of the UDPST server to test
                </p>
              </div>

              <div className="flex gap-3">
                <Button onClick={runQuickTest} disabled={loading || !targetServer.trim()}>
                  {loading ? 'Testing...' : 'Run Quick Test (2s)'}
                </Button>
                <Button onClick={runCompleteDiagnostics} variant="secondary" disabled={loading || !targetServer.trim()}>
                  {loading ? 'Running...' : 'Complete Diagnostics'}
                </Button>
              </div>
            </div>

            {quickTestResult && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  {quickTestResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <h3 className="font-semibold">
                    {quickTestResult.success ? 'Test Successful' : 'Test Failed'}
                  </h3>
                </div>

                {quickTestResult.success ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Throughput</label>
                        <p className="text-lg font-semibold">{quickTestResult.throughput?.toFixed(2) || 0} Mbps</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Intervals Collected</label>
                        <p className="text-lg font-semibold">{quickTestResult.intervals_collected}</p>
                      </div>
                    </div>
                    <p className="text-sm text-green-700 mt-4">
                      Connection verified successfully. The UDPST server is reachable and responsive.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-red-700 mb-2">
                      Error: {quickTestResult.error || 'Unknown error'}
                    </p>
                    {quickTestResult.raw_output && (
                      <div className="mt-3 bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
                        <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                          {quickTestResult.raw_output}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {completeDiagnostics && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Complete Diagnostics Results</h3>
                  <StatusBadge status={
                    completeDiagnostics.overallStatus === 'HEALTHY' ? 'completed' :
                    completeDiagnostics.overallStatus === 'WARNING' ? 'running' : 'failed'
                  }>
                    {completeDiagnostics.overallStatus}
                  </StatusBadge>
                </div>

                {completeDiagnostics.criticalIssues && completeDiagnostics.criticalIssues.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-red-700 mb-2">Critical Issues</h4>
                    <ul className="space-y-1">
                      {completeDiagnostics.criticalIssues.map((issue, idx) => (
                        <li key={idx} className="text-sm text-red-600">• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {completeDiagnostics.recommendations && completeDiagnostics.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {completeDiagnostics.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-blue-600">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
