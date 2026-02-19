import { useState, useEffect } from 'react';
import { History, RefreshCw, Eye, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

export default function HistoryPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

  function handleDeleteTest(testId, e) {
    e.stopPropagation();
    setConfirmDeleteId(testId);
  }

  async function confirmDeleteTest() {
    const testId = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeleting(testId);

    try {
      await api.test.delete(testId);

      if (selectedTest?.testId === testId) {
        setSelectedTest(null);
      }

      await fetchTests();
    } catch (err) {
      console.error('Failed to delete test:', err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleClearAll() {
    setShowClearAllConfirm(false);
    setLoading(true);

    try {
      await api.test.deleteAll();
      setSelectedTest(null);
      await fetchTests();
    } catch (err) {
      console.error('Failed to clear all tests:', err);
      alert('Failed to clear all tests: ' + err.message);
    } finally {
      setLoading(false);
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

        <div className="flex gap-2">
          <Button
            onClick={() => setShowClearAllConfirm(true)}
            variant="secondary"
            disabled={loading || tests.length === 0}
          >
            <Trash2 size={20} className="inline mr-2" />
            Clear All
          </Button>

          <Button onClick={fetchTests} disabled={loading}>
            <RefreshCw size={20} className="inline mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {showClearAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Clear All Tests?
            </h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete all test records and results. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowClearAllConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleClearAll}
              >
                Delete All Tests
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Test?
            </h3>
            <p className="text-gray-600 mb-1">
              You are about to delete test:
            </p>
            <p className="text-sm font-mono text-gray-800 bg-gray-100 rounded px-2 py-1 mb-6 break-all">
              {confirmDeleteId}
            </p>
            <p className="text-gray-600 mb-6 -mt-4 text-sm">
              This will permanently remove the test record and all associated results.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeleteTest}
              >
                Delete Test
              </Button>
            </div>
          </div>
        </div>
      )}

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
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer group"
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteTest(test.test_id, e)}
                      disabled={deleting === test.test_id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete test"
                    >
                      <Trash2 size={16} />
                    </button>
                    <Eye size={16} className="text-gray-400" />
                  </div>
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
