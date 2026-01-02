import { formatTime } from '../utils/format';

/**
 * Header component with title, connection status, and last update time
 */
export function Header({ connectionStatus, lastUpdate, pollingInfo }) {
  const { current, total, markets } = pollingInfo || {};

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            ARBITRAGE MONITOR
          </h1>
          <p className="text-sm text-slate-500">
            Opinion × Polymarket
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* Connection status indicators */}
          <div className="flex items-center gap-4">
            <ConnectionIndicator
              name="Opinion"
              status={connectionStatus.opinion}
            />
            <ConnectionIndicator
              name="Poly"
              status={connectionStatus.poly}
            />
          </div>

          {/* Polling indicator */}
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-slate-400">
                Polling: <span className="text-slate-600">{markets?.join(', ') || '—'}</span>
                <span className="text-slate-300 ml-1">({current + 1}-{Math.min(current + (markets?.length || 0), total)}/{total})</span>
              </span>
            </div>
          )}

          {/* Last update time */}
          <div className="text-right">
            <div className="text-xs text-slate-500">Last Update</div>
            <div className="text-sm text-slate-600 font-mono">
              {lastUpdate ? formatTime(lastUpdate) : '—'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Connection status indicator
 */
function ConnectionIndicator({ name, status }) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-slate-400">{name}</span>
    </div>
  );
}

export default Header;
