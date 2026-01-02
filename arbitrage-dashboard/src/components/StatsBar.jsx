import { formatPct } from '../utils/format';

/**
 * Stats bar showing key metrics
 */
export function StatsBar({ stats }) {
  const cards = [
    {
      label: 'Markets',
      value: stats.totalMarkets,
      color: 'text-slate-700'
    },
    {
      label: 'Opportunities',
      value: stats.opportunities,
      color: stats.opportunities > 0 ? 'text-green-600' : 'text-slate-700'
    },
    {
      label: 'Hot',
      value: stats.hotCount,
      color: stats.hotCount > 0 ? 'text-orange-600' : 'text-slate-700'
    },
    {
      label: 'Avg Spread',
      value: formatPct(stats.avgSpread, false),
      color: 'text-blue-600'
    },
    {
      label: 'Max Spread',
      value: formatPct(stats.maxSpread, false),
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="card rounded-lg p-4 text-center"
        >
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            {card.label}
          </div>
          <div className={`text-xl font-bold ${card.color}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsBar;
