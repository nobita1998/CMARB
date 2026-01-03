import { useState, useMemo } from 'react';
import { usePolling } from './hooks/usePolling';
import { useArbitrage, sortOpportunities, filterOpportunities } from './hooks/useArbitrage';
import { useWallet } from './hooks/useWallet';
import { usePositions } from './hooks/usePositions';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { FilterBar } from './components/FilterBar';
import { MarketTable } from './components/MarketTable';
import { Footer } from './components/Footer';

// Get Opinion API key from environment
const OPINION_API_KEY = import.meta.env.VITE_OPINION_API_KEY || '';

function App() {
  // Filter and sort state
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('apy');
  const [profitableOnly, setProfitableOnly] = useState(false);
  const [myPositionsOnly, setMyPositionsOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Settings (exit threshold, share threshold)
  const [settings, setSettings] = useState({
    exitThreshold: 0.98,
    shareThreshold: 10
  });

  // Wallet management
  const { wallet, setWallet } = useWallet();

  // Fetch price data
  const { prices, loading, error, lastUpdate, connectionStatus, pollingInfo } = usePolling();

  // Monitor user positions
  const { matchedPositions, arbitragePositions, loading: positionsLoading } = usePositions(
    wallet, OPINION_API_KEY, prices, settings.exitThreshold, settings.shareThreshold
  );

  // Calculate arbitrage opportunities
  const { opportunities, stats } = useArbitrage(prices);

  // Filter and sort opportunities
  const allFilteredOpportunities = useMemo(() => {
    let filtered = filterOpportunities(opportunities, filter);
    if (profitableOnly) {
      filtered = filtered.filter(o => o.netProfit > 0);
    }
    if (myPositionsOnly) {
      filtered = filtered.filter(o => {
        const key = `${o.eventId}-${o.outcome}`;
        return matchedPositions?.has(key);
      });
    }

    // Sort by exitPct uses arbitragePositions data
    if (sortBy === 'exitPct') {
      return [...filtered].sort((a, b) => {
        const keyA = `${a.eventId}-${a.outcome}`;
        const keyB = `${b.eventId}-${b.outcome}`;
        const exitA = arbitragePositions?.get(keyA)?.exitProfit?.exitPriceSum || 0;
        const exitB = arbitragePositions?.get(keyB)?.exitProfit?.exitPriceSum || 0;
        return exitB - exitA; // Higher exit % first
      });
    }

    return sortOpportunities(filtered, sortBy);
  }, [opportunities, filter, sortBy, profitableOnly, myPositionsOnly, matchedPositions, arbitragePositions]);

  // Pagination
  const totalPages = Math.ceil(allFilteredOpportunities.length / pageSize);
  const displayedOpportunities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allFilteredOpportunities.slice(start, start + pageSize);
  }, [allFilteredOpportunities, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setCurrentPage(1);
  };
  const handleProfitableOnlyChange = (val) => {
    setProfitableOnly(val);
    setCurrentPage(1);
  };
  const handleMyPositionsOnlyChange = (val) => {
    setMyPositionsOnly(val);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Header
          connectionStatus={connectionStatus}
          lastUpdate={lastUpdate}
          pollingInfo={pollingInfo}
          wallet={wallet}
          onWalletChange={setWallet}
          positionsInfo={{ count: arbitragePositions.size, loading: positionsLoading }}
          settings={settings}
          onSettingsChange={setSettings}
        />

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && opportunities.length === 0 && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-sm">
            Loading market data...
          </div>
        )}

        {/* Stats Bar */}
        <StatsBar stats={stats} />

        {/* Filter Bar */}
        <FilterBar
          filter={filter}
          sortBy={sortBy}
          profitableOnly={profitableOnly}
          myPositionsOnly={myPositionsOnly}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          onProfitableOnlyChange={handleProfitableOnlyChange}
          onMyPositionsOnlyChange={handleMyPositionsOnlyChange}
        />

        {/* Market Table */}
        <MarketTable
          opportunities={displayedOpportunities}
          totalCount={allFilteredOpportunities.length}
          profitableOnly={profitableOnly}
          matchedPositions={matchedPositions}
          arbitragePositions={arbitragePositions}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}

export default App;
