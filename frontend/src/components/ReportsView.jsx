import React, { useState, useEffect } from 'react';

export default function ReportsView({ token }) {
  const [logs, setLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/sales/history', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Ledger sync failure:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadLogs();
  }, [token]);

  return (
    <div className={`space-y-10 transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <header className="space-y-1 text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">
          Financial Ledger
        </h1>
        <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">
          audit / chronological_transactions
        </p>
      </header>

      <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl overflow-hidden shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {logs.length === 0 ? (
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
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-sans text-zinc-500 tracking-tight">
                      {log.quantity_sold || log.quantity || 0} units
                    </span>
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