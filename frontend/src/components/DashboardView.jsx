import React, { useState, useEffect } from 'react';

export default function DashboardView({ token }) {
  const [metrics, setMetrics] = useState({ totalStock: 0, itemsCount: 0, revenue: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const [pRes, sRes] = await Promise.all([
          fetch('http://localhost:5000/api/products', { headers }),
          fetch('http://localhost:5000/api/sales/history', { headers })
        ]);
        const products = await pRes.json();
        const sales = await sRes.json();

        setMetrics({
          totalStock: products.reduce((acc, p) => acc + (p.quantity || 0), 0),
          itemsCount: products.length,
          revenue: sales.reduce((acc, s) => acc + parseFloat(s.total_revenue || 0), 0)
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadOverview();
  }, [token]);

  return (
    <div className={`space-y-10 transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <header className="space-y-1 text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">
          Dashboard Matrix
        </h1>
        <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">
          overview / macro_parameters
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Massive Net Revenue Panel */}
        <div className="md:col-span-2 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-8 flex flex-col justify-between min-h-[240px] shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-md dark:hover:shadow-[0_4px_32px_rgba(16,185,129,0.05)] hover:border-[#10b981]/40 dark:hover:border-[#10b981]/20 transition-all duration-500 group relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-sans">Net Revenue</span>
            <span className="px-2 py-1 rounded bg-[#10b981]/10 text-[#10b981] text-xs font-mono tracking-tight flex items-center gap-1.5 border border-[#10b981]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              active
            </span>
          </div>
          <div className="mt-8">
            <span className="text-7xl font-semibold tracking-tighter text-zinc-900 dark:text-white font-sans">
              ${metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#10b981]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Total Unit Volume */}
        <div className="md:col-span-1 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-8 flex flex-col justify-between min-h-[240px] shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-md dark:hover:shadow-[0_4px_32px_rgba(255,255,255,0.02)] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-500">
          <div className="flex items-start justify-between">
            <span className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-sans">Total Volume</span>
          </div>
          <div className="mt-8">
            <span className="text-5xl font-semibold tracking-tighter text-zinc-900 dark:text-white font-sans">
              {metrics.totalStock.toLocaleString()}
            </span>
            <span className="text-sm tracking-tight text-zinc-400 dark:text-zinc-500 font-mono block mt-2 lowercase">units</span>
          </div>
        </div>

        {/* Distinct Catalog Lines */}
        <div className="md:col-span-1 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-8 flex flex-col justify-between min-h-[240px] shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-md dark:hover:shadow-[0_4px_32px_rgba(255,255,255,0.02)] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-500">
          <div className="flex items-start justify-between">
            <span className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-sans">Catalog Lines</span>
          </div>
          <div className="mt-8">
            <span className="text-5xl font-semibold tracking-tighter text-zinc-900 dark:text-white font-sans">
              {metrics.itemsCount.toLocaleString()}
            </span>
            <span className="text-sm tracking-tight text-zinc-400 dark:text-zinc-500 font-mono block mt-2 lowercase">rows</span>
          </div>
        </div>
      </div>
    </div>
  );
}