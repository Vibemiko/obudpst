import { useState, useEffect } from 'react';
import { History, RefreshCw, Eye } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

export default function HistoryPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTests();
  }, [filter]);

  async function fetchTests() {
    setLoading(true);

    try {
      const params = {
        limit: 50,
        offset: 0
      };

      if (filter !== 'all') {
        params.status = filter;
      }

      const result = await api.test.list(params);
      setTests(result.tests);
    } catch (err) {
      console.error('Failed to fetch tests:', err);
    } finally {
      setLoading(false);
    }
  }

  async function viewTestDetails(testId) {
    try {
      const results = await api.test.getResults(testId);
      setSelectedTest(results);
    } catch (err) {
      console.error('Failed to fetch test details:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Test History</h1>
          <p className="mt-2 text-gray-600">
            View past test executions and results
          </p>
        </div>

        <Button onClick={fetchTests} disabled={loading}>
          <RefreshCw size={20} className="inline mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All
        </FilterButton>
        <FilterButton
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
        >
          Completed
        </FilterButton>
        <FilterButton
          active={filter === 'running'}
          onClick={() => setFilter('running')}
        >
          Running
        </FilterButton>
        <FilterButton
          active={filter === 'failed'}
          onClick={() => setFilter('failed')}
        >
          Failed
        </FilterButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Tests" className="lg:col-span-2">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-8">
              <History size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No tests found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                  onClick={() => viewTestDetails(test.test_id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-900">{test.test_id}</span>
                      <StatusBadge status={test.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-gray-500 capitalize">{test.test_type}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(test.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Eye size={16} className="text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Test Details">
          {selectedTest ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-medium text-gray-500">Test ID</span>
                <p className="text-sm font-mono text-gray-900 mt-1">{selectedTest.testId}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500">Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedTest.status} />
                </div>
              </div>

              {selectedTest.completedAt && (
                <div>
                  <span className="text-xs font-medium text-gray-500">Completed At</span>
                  <p className="text-sm text-gray-900 mt-1">
                    {new Date(selectedTest.completedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {selectedTest.results && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500">Throughput</span>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedTest.results.throughput.toFixed(2)} Mbps
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Packet Loss</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedTest.results.packetLoss.toFixed(4)}%
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Latency</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedTest.results.latency.toFixed(2)} ms
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500">Jitter</span>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedTest.results.jitter.toFixed(2)} ms
                    </p>
                  </div>
                </div>
              )}

              {selectedTest.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <span className="text-xs font-medium text-red-800">Error</span>
                  <p className="text-xs text-red-700 mt-1">{selectedTest.errorMessage}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">Select a test to view details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-primary-100 text-primary-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
