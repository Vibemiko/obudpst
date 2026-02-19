import { AlertTriangle } from 'lucide-react';

export default function StatusBadge({ status, showIcon = false }) {
  const variants = {
    pending: 'bg-gray-100 text-gray-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    completed_warnings: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-800',
    stopped: 'bg-yellow-100 text-yellow-800'
  };

  const displayText = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    completed_warnings: 'Completed',
    failed: 'Failed',
    stopped: 'Stopped'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || variants.pending}`}>
      {status === 'completed_warnings' && showIcon && (
        <AlertTriangle size={12} />
      )}
      {displayText[status] || status}
    </span>
  );
}
