import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader, RefreshCw, Info } from 'lucide-react';
import Button from './Button';

export default function ServerHealthCheck({ servers, port, onCheckComplete }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);

  async function handleCheck() {
    setChecking(true);
    setResults(null);

    try {
      const { checkServers } = await import('../services/api').then(m => m.api.health);
      const serverList = servers.split(',').map(s => s.trim()).filter(s => s);
      const healthResults = await checkServers(serverList, port);
      setResults(healthResults);

      if (onCheckComplete) {
        onCheckComplete(healthResults);
      }
    } catch (err) {
      setResults({
        allReachable: false,
        error: err.message,
        servers: []
      });
    } finally {
      setChecking(false);
    }
  }

  if (!servers || !servers.trim()) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Info size={16} className="text-blue-500" />
          Server Health Check
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCheck}
          disabled={checking}
          className="text-xs"
        >
          {checking ? (
            <>
              <Loader size={14} className="inline mr-1.5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw size={14} className="inline mr-1.5" />
              Check Servers
            </>
          )}
        </Button>
      </div>

      {checking && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader size={20} className="text-blue-600 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Checking server connectivity...</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Testing network reachability and port accessibility
              </p>
            </div>
          </div>
        </div>
      )}

      {results && !checking && (
        <div className="space-y-3">
          {results.allReachable ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">
                    All servers are reachable
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {results.reachableServers} of {results.totalServers} server(s) passed all health checks.
                    You can proceed with the test.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">
                    {results.unreachableServers === results.totalServers
                      ? 'No servers are reachable'
                      : 'Some servers are not reachable'}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {results.reachableServers} of {results.totalServers} server(s) are accessible.
                    Fix connectivity issues before running the test.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {results.servers && results.servers.map((server, idx) => (
              <ServerCheckResult key={idx} result={server} />
            ))}
          </div>

          {results.error && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">{results.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServerCheckResult({ result }) {
  const allPassed = result.checks?.every(c => c.passed) || false;

  return (
    <div className={`rounded-lg border p-3 ${
      result.reachable
        ? 'bg-green-50 border-green-200'
        : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          {result.reachable ? (
            <CheckCircle size={16} className="text-green-600" />
          ) : (
            <XCircle size={16} className="text-red-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-medium ${
              result.reachable ? 'text-green-900' : 'text-red-900'
            }`}>
              {result.host}:{result.port}
            </p>
            <span className={`text-xs font-semibold ${
              result.reachable ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.reachable ? 'Reachable' : 'Unreachable'}
            </span>
          </div>

          {result.checks && result.checks.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {result.checks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {check.passed ? (
                      <CheckCircle size={12} className="text-green-600" />
                    ) : (
                      <XCircle size={12} className="text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs ${
                      check.passed ? 'text-green-800' : 'text-red-800'
                    }`}>
                      <span className="font-medium">{check.name}:</span> {check.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.recommendation && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-800">
                <span className="font-semibold">Recommendation:</span> {result.recommendation}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
