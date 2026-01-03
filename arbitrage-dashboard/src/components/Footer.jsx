/**
 * Footer with operation guide
 */
export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 pt-6">
      <div className="max-w-xl mx-auto">
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
