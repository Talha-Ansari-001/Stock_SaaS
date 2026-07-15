import React from 'react';

export default function ReportsView({ salesHistory = [], isLoaded = false, refreshReports }) {
  const logs = salesHistory;

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">
            Financial Ledger
          </h1>
          <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">
            audit / chronological_transactions
          </p>
        </div>
        {refreshReports && (
          <button
            onClick={refreshReports}
            className="text-xs font-mono tracking-tight px-3 py-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-zinc-500 transition-all"
          >
            ↻ Refresh
          </button>
        )}
      </header>

      <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl overflow-hidden shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {!isLoaded ? (
            <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm font-mono tracking-tight animate-pulse">
              Syncing ledger...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm font-sans tracking-tight">
              No transaction histories recorded
            </div>
          ) : (
            <div className="flex flex-col">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800/60 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5"
                >
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white tracking-tight">
                      {log.product_name || 'Unknown Product'}
                    </span>
                    <span className="text-xs font-mono text-zinc-500 tracking-tight">
                      {log.sold_at
                        ? new Date(log.sold_at).toLocaleString('en-US', {
                            month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
                          })
                        : 'Date unavailable'}
                    </span>
                    {log.buyer_name && (
                      <span className="text-xs font-sans text-zinc-400 tracking-tight">
                        {log.buyer_name}{log.buyer_contact ? ` · ${log.buyer_contact}` : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-sans text-zinc-500 tracking-tight block">
                        {log.quantity_sold || 0} {log.quantity_unit || 'units'}
                      </span>
                      {log.payment_method && (
                        <span className="text-[10px] font-mono text-zinc-500 tracking-tight block capitalize">
                          {log.payment_method}
                        </span>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-[#10b981]/10 text-[#10b981] font-mono text-sm tracking-tight font-medium">
                      +${parseFloat(log.total_revenue || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}