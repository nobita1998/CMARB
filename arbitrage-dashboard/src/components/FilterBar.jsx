import { getMarketTypes } from '../config/markets';

/**
 * Filter and sort controls
 */
export function FilterBar({ filter, sortBy, profitableOnly, onFilterChange, onSortChange, onProfitableOnlyChange }) {
  const types = getMarketTypes();

  const sortOptions = [
    { value: 'netProfit', label: 'Net Profit' },
    { value: 'spread', label: 'Spread' },
    { value: 'depth', label: 'Depth' }
  ];

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Type filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Filter:</span>
        <div className="flex gap-1">
          {types.map(type => (
            <button
              key={type}
              onClick={() => onFilterChange(type)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === type
                  ? 'bg-blue-100 text-blue-600 border border-blue-300'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Profitable only toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={profitableOnly}
            onChange={(e) => onProfitableOnlyChange(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500"
          />
          <span className="text-xs text-slate-600">Only Profitable</span>
        </label>

        {/* Sort options */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-white border border-slate-200 rounded px-3 py-1 text-xs text-slate-600 focus:outline-none focus:border-blue-400"
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default FilterBar;
