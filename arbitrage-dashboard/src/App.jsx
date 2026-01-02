import { useState, useMemo } from 'react';
import { usePolling } from './hooks/usePolling';
import { useArbitrage, sortOpportunities, filterOpportunities } from './hooks/useArbitrage';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { FilterBar } from './components/FilterBar';
import { MarketTable } from './components/MarketTable';
import { Footer } from './components/Footer';

function App() {
  // Filter and sort state
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('netProfit');
  const [profitableOnly, setProfitableOnly] = useState(false);

  // Fetch price data
  const { prices, loading, error, lastUpdate, connectionStatus, pollingInfo } = usePolling();

  // Calculate arbitrage opportunities
  const { opportunities, stats } = useArbitrage(prices);

  // Filter and sort opportunities
  const displayedOpportunities = useMemo(() => {
    let filtered = filterOpportunities(opportunities, filter);
    if (profitableOnly) {
      filtered = filtered.filter(o => o.netProfit > 0);
    }
    return sortOpportunities(filtered, sortBy);
  }, [opportunities, filter, sortBy, profitableOnly]);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Header
          connectionStatus={connectionStatus}
          lastUpdate={lastUpdate}
          pollingInfo={pollingInfo}
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
          onFilterChange={setFilter}
          onSortChange={setSortBy}
          onProfitableOnlyChange={setProfitableOnly}
        />

        {/* Market Table */}
        <MarketTable
          opportunities={displayedOpportunities}
          totalCount={opportunities.length}
          profitableOnly={profitableOnly}
        />

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}

export default App;
