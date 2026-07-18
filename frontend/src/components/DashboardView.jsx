import React, { useMemo } from 'react';

export default function DashboardView({ products = [], salesHistory = [], isLoaded = false }) {
  // ── KPI CALCULATIONS ──────────────────────────────────────────
  const totalRevenue = useMemo(() =>
    salesHistory.reduce((acc, s) => acc + (parseFloat(s.total_revenue || 0) - parseFloat(s.amount_refunded || 0)), 0),
    [salesHistory]
  );

  const totalCost = useMemo(() => {
    // Map product buying prices by id for lookup
    const priceMap = {};
    products.forEach(p => { priceMap[p.id] = parseFloat(p.buying_price || 0); });
    return salesHistory.reduce((acc, s) => {
      const buyPrice = priceMap[s.product_id] || 0;
      return acc + buyPrice * parseFloat(s.quantity_sold || 0);
    }, 0);
  }, [salesHistory, products]);

  const netProfit = totalRevenue - totalCost;

  const totalReceived = useMemo(() =>
    salesHistory.reduce((acc, s) => {
      const isCreditOrPartial = s.payment_method?.toLowerCase().includes('credit') || s.payment_method?.toLowerCase().includes('partial');
      return acc + parseFloat(isCreditOrPartial ? (s.amount_paid || 0) : (s.total_revenue || 0));
    }, 0),
    [salesHistory]
  );

  const totalOutstanding = useMemo(() =>
    salesHistory.reduce((acc, s) => {
      const isCreditOrPartial = s.payment_method?.toLowerCase().includes('credit') || s.payment_method?.toLowerCase().includes('partial');
      return acc + (isCreditOrPartial ? (parseFloat(s.total_revenue || 0) - parseFloat(s.amount_paid || 0) - parseFloat(s.amount_refunded || 0)) : 0);
    }, 0),
    [salesHistory]
  );

  const totalItems = useMemo(() =>
    products.reduce((acc, p) => acc + parseFloat(p.quantity || 0), 0),
    [products]
  );

  const todayRevenue = useMemo(() => {
    const today = new Date().toDateString();
    return salesHistory
      .filter(s => s.sold_at && new Date(s.sold_at).toDateString() === today)
      .reduce((acc, s) => acc + (parseFloat(s.total_revenue || 0) - parseFloat(s.amount_refunded || 0)), 0);
  }, [salesHistory]);

  // Low stock items (quantity <= 5)
  const lowStockItems = useMemo(() =>
    products.filter(p => parseFloat(p.quantity || 0) <= 5),
    [products]
  );

  // Recent sales (last 6)
  const recentSales = useMemo(() =>
    [...salesHistory].slice(0, 6),
    [salesHistory]
  );

  // Top products by revenue
  const topProducts = useMemo(() => {
    const map = {};
    salesHistory.forEach(s => {
      if (!map[s.product_name]) map[s.product_name] = 0;
      map[s.product_name] += parseFloat(s.total_revenue || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [salesHistory]);

  const maxProductRevenue = topProducts.length > 0 ? topProducts[0][1] : 1;

  const fmt = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted font-mono text-xs tracking-widest animate-pulse">
        Syncing dashboard data...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <header className="space-y-1 text-left">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-text-primary font-sans">
          Command Center
        </h1>
        <p className="text-xs md:text-sm tracking-tight text-text-muted font-mono lowercase">
          overview / live_metrics_dashboard
        </p>
      </header>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Billed Sales */}
        <div className="bg-panel border border-border-subtle rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Total Billed</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-emerald-500 tracking-tight">₹{fmt(totalRevenue)}</p>
            <p className="text-[10px] text-text-muted font-mono mt-1">Order totals</p>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="bg-panel border border-border-subtle rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Received</span>
            <span className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-teal-500 tracking-tight">₹{fmt(totalReceived)}</p>
            <p className="text-[10px] text-text-muted font-mono mt-1">Cash in hand</p>
          </div>
        </div>

        {/* Dues Pending */}
        <div className="bg-panel border border-border-subtle rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Dues Pending</span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-amber-500 tracking-tight">₹{fmt(totalOutstanding)}</p>
            <p className="text-[10px] text-text-muted font-mono mt-1">Credit / Unpaid</p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-panel border border-border-subtle rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Net Profit</span>
            <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <div>
            <p className={`text-xl font-bold font-mono tracking-tight ${netProfit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              ₹{fmt(Math.abs(netProfit))}
            </p>
            <p className="text-[10px] text-text-muted font-mono mt-1">{netProfit >= 0 ? 'Profit' : 'Loss'}</p>
          </div>
        </div>

        {/* Today's Sales */}
        <div className="bg-panel border border-border-subtle rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Today's Sales</span>
            <span className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-purple-400 tracking-tight">₹{fmt(todayRevenue)}</p>
            <p className="text-[10px] text-text-muted font-mono mt-1">Today</p>
          </div>
        </div>

        {/* Total Stock */}
        <div className="bg-panel border border-border-subtle rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">Stock (Bags)</span>
            <span className="w-8 h-8 rounded-lg bg-zinc-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-zinc-300 tracking-tight">{Number(totalItems).toFixed(0)}</p>
            <p className="text-[10px] text-text-muted font-mono mt-1">{products.length} SKUs active</p>
          </div>
        </div>
      </div>

      {/* SECOND ROW: Top Products + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* TOP PRODUCTS BY REVENUE */}
        <div className="bg-panel border border-border-subtle rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle/50">
            <h2 className="text-sm font-medium tracking-tight text-text-primary font-sans">Top Products</h2>
            <p className="text-[11px] font-mono text-text-muted mt-0.5">by revenue generated</p>
          </div>
          <div className="p-5 space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-xs text-text-muted font-mono text-center py-6">No sales data available yet.</p>
            ) : (
              topProducts.map(([name, revenue]) => (
                <div key={name} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-primary truncate max-w-[60%]">{name}</span>
                    <span className="text-xs font-mono text-emerald-500 font-semibold">₹{fmt(revenue)}</span>
                  </div>
                  <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${(revenue / maxProductRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT SALES */}
        <div className="bg-panel border border-border-subtle rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle/50">
            <h2 className="text-sm font-medium tracking-tight text-text-primary font-sans">Recent Transactions</h2>
            <p className="text-[11px] font-mono text-text-muted mt-0.5">last 6 sales</p>
          </div>
          <div className="divide-y divide-border-subtle/40">
            {recentSales.length === 0 ? (
              <p className="text-xs text-text-muted font-mono text-center py-8">No sales recorded yet.</p>
            ) : (
              recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface/40 transition-colors">
                  <div className="space-y-0.5 text-left">
                    <p className="text-sm font-medium text-text-primary">{s.product_name || 'Unknown'}</p>
                    <p className="text-[11px] font-mono text-text-muted">
                      {s.sold_at ? new Date(s.sold_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      {s.buyer_name ? ` · ${s.buyer_name}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-emerald-500">+₹{fmt(parseFloat(s.total_revenue || 0))}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* LOW STOCK ALERTS */}
      {lowStockItems.length > 0 && (
        <div className="bg-panel border border-amber-500/30 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-500/20 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-sm font-medium tracking-tight text-amber-500 font-sans">Low Stock Alerts</h2>
            <span className="ml-auto text-[11px] font-mono text-amber-500/70">{lowStockItems.length} items</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
            {lowStockItems.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{p.name}</p>
                  {p.supplier_name && <p className="text-[11px] text-text-muted font-mono">{p.supplier_name}</p>}
                </div>
                <span className="text-sm font-bold font-mono text-amber-500">
                  {Number(p.quantity).toFixed(2)} <span className="text-[10px] font-normal">bags</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVENTORY SNAPSHOT TABLE */}
      <div className="bg-panel border border-border-subtle rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle/50">
          <h2 className="text-sm font-medium tracking-tight text-text-primary font-sans">Inventory Snapshot</h2>
          <p className="text-[11px] font-mono text-text-muted mt-0.5">current stock levels</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle/50 bg-surface/50">
                <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Product</th>
                <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Stock</th>
                <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Total Kg</th>
                <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Buy Price</th>
                <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Sell Price</th>
                <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/30">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-text-muted text-xs font-mono">
                    No inventory items found. Add products via the Inventory tab.
                  </td>
                </tr>
              ) : (
                products.map(p => {
                  const qty = parseFloat(p.quantity || 0);
                  const kgPerUnit = parseFloat(p.kg_per_unit || 1);
                  const totalKg = (qty * kgPerUnit).toFixed(2);
                  const isLow = qty <= 5;
                  return (
                    <tr key={p.id} className="hover:bg-surface/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-text-primary">{p.name}</p>
                        {p.supplier_name && <p className="text-[10px] text-text-muted font-mono">{p.supplier_name}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-sm text-text-primary">{Number(qty).toFixed(2)} bags</td>
                      <td className="px-5 py-3.5 font-mono text-sm text-text-secondary">{totalKg} Kg</td>
                      <td className="px-5 py-3.5 font-mono text-sm text-text-secondary">₹{parseFloat(p.buying_price || 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5 font-mono text-sm font-semibold text-text-primary">₹{parseFloat(p.price || 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${isLow ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}