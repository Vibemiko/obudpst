import { useState, useEffect } from 'react';
import { Power, PowerOff, CheckCircle, XCircle } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { api } from '../services/api';

export default function ServerPage() {
  const [serverStatus, setServerStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [config, setConfig] = useState({
    port: 25000,
    interface: '',
    daemon: false,
    authKey: '',
    verbose: false
  });

  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchServerStatus() {
    try {
      const status = await api.server.getStatus();
      setServerStatus(status);
    } catch (err) {
      console.error('Failed to fetch server status:', err);
    }
  }

  async function handleStart() {
    setLoading(true);
    setError(null);

    try {
      await api.server.start(config);
      await fetchServerStatus();
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
      await fetchServerStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Server Control</h1>
          <p className="mt-2 text-gray-600">
            Manage OB-UDPST server instance
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <XCircle className="text-red-500 mr-3 flex-shrink-0" size={20} />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Server Status">
          <div className="space-y-4">
            {serverStatus?.running ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <div className="flex items-center text-green-600">
                    <CheckCircle size={20} className="mr-2" />
                    <span className="font-semibold">Running</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Process ID</span>
                  <span className="text-sm text-gray-900">{serverStatus.pid}</span>
                </div>

                {serverStatus.uptime !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Uptime</span>
                    <span className="text-sm text-gray-900">{formatUptime(serverStatus.uptime)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Port</span>
                  <span className="text-sm text-gray-900">{serverStatus.config?.port || 25000}</span>
                </div>

                {serverStatus.config?.interface && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Interface</span>
                    <span className="text-sm text-gray-900">{serverStatus.config.interface}</span>
                  </div>
                )}

                <Button
                  variant="danger"
                  onClick={handleStop}
                  disabled={loading}
                  className="w-full mt-4"
                >
                  <PowerOff size={20} className="inline mr-2" />
                  Stop Server
                </Button>
              </>
            ) : (
              <div className="text-center py-8">
                <XCircle size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Server is not running</p>
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

            <Input
              label="Interface IP Address"
              value={config.interface}
              onChange={(e) => setConfig({ ...config, interface: e.target.value })}
              placeholder="Leave empty for all interfaces"
              disabled={serverStatus?.running}
            />

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

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.verbose}
                  onChange={(e) => setConfig({ ...config, verbose: e.target.checked })}
                  disabled={serverStatus?.running}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Verbose output</span>
              </label>
            </div>

            {!serverStatus?.running && (
              <Button
                variant="primary"
                onClick={handleStart}
                disabled={loading}
                className="w-full"
              >
                <Power size={20} className="inline mr-2" />
                Start Server
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}
