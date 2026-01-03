import { useState } from 'react';
import { formatTime } from '../utils/format';

/**
 * Header component with title, connection status, wallet settings, and last update time
 */
export function Header({ connectionStatus, lastUpdate, pollingInfo, wallet, onWalletChange, positionsInfo, settings, onSettingsChange }) {
  const { current, total, markets } = pollingInfo || {};
  const [showWalletSettings, setShowWalletSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

          {/* Positions indicator */}
          {positionsInfo?.count > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs text-slate-600">
                {positionsInfo.count} positions
              </span>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1 text-xs rounded border transition-colors bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
          >
            ⚙ Settings
          </button>

          {/* Wallet settings button */}
          <button
            onClick={() => setShowWalletSettings(!showWalletSettings)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              wallet?.opinion || wallet?.poly
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {wallet?.opinion || wallet?.poly ? 'Wallet Set' : 'Set Wallet'}
          </button>

          {/* Polling indicator */}
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-slate-400">
                Polling <span className="text-slate-500">{current + 1}-{Math.min(current + (markets?.length || 0), total)}/{total}</span>
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

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Wallet settings panel */}
      {showWalletSettings && (
        <WalletSettings
          wallet={wallet}
          onWalletChange={onWalletChange}
          onClose={() => setShowWalletSettings(false)}
        />
      )}
    </header>
  );
}

/**
 * Settings panel for exit threshold and share threshold
 */
function SettingsPanel({ settings, onSettingsChange, onClose }) {
  const [exitThreshold, setExitThreshold] = useState(settings?.exitThreshold || 0.98);
  const [shareThreshold, setShareThreshold] = useState(settings?.shareThreshold || 10);

  const handleSave = () => {
    onSettingsChange({
      exitThreshold: parseFloat(exitThreshold) || 0.98,
      shareThreshold: parseFloat(shareThreshold) || 10
    });
    onClose();
  };

  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">Settings</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Exit Threshold</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.90"
              max="1.00"
              step="0.01"
              value={exitThreshold}
              onChange={(e) => setExitThreshold(e.target.value)}
              className="w-20 px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-purple-300 text-center"
            />
            <span className="text-xs text-slate-400">({(exitThreshold * 100).toFixed(0)}%)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">EXIT NOW signal threshold</p>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Share Threshold</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value={shareThreshold}
              onChange={(e) => setShareThreshold(e.target.value)}
              className="w-20 px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-purple-300 text-center"
            />
            <span className="text-xs text-slate-400">shares</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Min shares to show position</p>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={handleSave}
          className="px-4 py-1 text-xs bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * Wallet settings panel
 */
function WalletSettings({ wallet, onWalletChange, onClose }) {
  const [opinionAddr, setOpinionAddr] = useState(wallet?.opinion || '');
  const [polyAddr, setPolyAddr] = useState(wallet?.poly || '');

  const handleSave = () => {
    onWalletChange({
      opinion: opinionAddr.trim(),
      poly: polyAddr.trim()
    });
    onClose();
  };

  const handleClear = () => {
    setOpinionAddr('');
    setPolyAddr('');
    onWalletChange({ opinion: '', poly: '' });
  };

  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">Wallet Addresses</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
        >
          x
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Opinion Wallet</label>
          <input
            type="text"
            value={opinionAddr}
            onChange={(e) => setOpinionAddr(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-orange-300"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Polymarket Wallet</label>
          <input
            type="text"
            value={polyAddr}
            onChange={(e) => setPolyAddr(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-300"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={handleClear}
          className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1 text-xs bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          Save
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Enter wallet addresses to monitor your arbitrage positions. Positions will be checked every 30 seconds.
      </p>
    </div>
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
