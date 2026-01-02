import { getFeeReferenceTable } from '../utils/fees';

/**
 * Footer with fee reference table and operation guide
 */
export function Footer() {
  const feeTable = getFeeReferenceTable();

  return (
    <footer className="mt-8 border-t border-slate-200 pt-6">
      <div className="grid grid-cols-2 gap-8">
        {/* Fee Reference Table */}
        <div>
          <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            Opinion Fee Reference
          </h3>
          <div className="card rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-slate-500">Price</th>
                  <th className="text-right px-3 py-2 text-slate-500">Nominal</th>
                  <th className="text-right px-3 py-2 text-slate-500">Effective</th>
                </tr>
              </thead>
              <tbody>
                {feeTable.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 text-slate-700">
                      {(row.price * 100).toFixed(0)}¢
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500">
                      {(row.nominalFee * 100).toFixed(3)}%
                    </td>
                    <td className="px-3 py-1.5 text-right text-amber-600">
                      {(row.effectiveFee * 100).toFixed(3)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            <div>* Effective fee = Nominal fee × 0.5 (after points rebate)</div>
            <div>* Minimum fee: $0.50 per trade</div>
          </div>
        </div>

        {/* Operation Guide */}
        <div>
          <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            Operation Guide
          </h3>
          <div className="card rounded-lg p-4 text-xs text-slate-500 space-y-3">
            <div className="flex items-start gap-2">
              <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 py-0.5 rounded font-bold">
                HOT
              </span>
              <span>
                Net profit {'>'} 5%. High priority opportunity, consider immediate action.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="border border-green-500 text-green-600 px-1.5 py-0.5 rounded font-bold">
                GO
              </span>
              <span>
                Net profit {'>'} 2%. Valid opportunity, check depth before trading.
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <div className="font-medium text-slate-700 mb-1">Workflow:</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-500">
                <li>Check signal status and net profit</li>
                <li>Verify depth is sufficient for your order size</li>
                <li>Compare bid/ask spreads on both platforms</li>
                <li>Execute trades on both platforms simultaneously</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 mt-6">
        Arbitrage Monitor v1.0 | Data refreshes every 10 seconds
      </div>
    </footer>
  );
}

export default Footer;
