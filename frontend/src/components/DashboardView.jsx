import React, { useState, useMemo } from 'react';

export default function ReportsView({ salesHistory = [], isLoaded = false, refreshReports }) {
  // --- FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState(''); // Handles both Customer Name & Contact Number
  const [productType, setProductType] = useState(''); // Filters by product name matching
  const [paymentMethod, setPaymentMethod] = useState('All'); // All | Cash | Online | Credit
  const [timePreset, setTimePreset] = useState('All'); // All | Today | This Week | This Month | Custom
  
  // Custom Date Range States (shown only if timePreset is 'Custom')
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Price (Revenue) Range States
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Toggle filter visibility
  const [showFilters, setShowFilters] = useState(false);

  // --- GET UNIQUE PRODUCT NAMES FOR DROPDOWN ---
  const uniqueProducts = useMemo(() => {
    const names = salesHistory.map(s => s.product_name).filter(Boolean);
    return [...new Set(names)].sort();
  }, [salesHistory]);

  // --- FILTER ENGINE ---
  const filteredLogs = useMemo(() => {
    const now = new Date();

    return salesHistory.filter((log) => {
      // 1. Search Query: Customer Name / Contact Number
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = log.buyer_name?.toLowerCase().includes(query);
        const contactMatch = log.buyer_contact?.toLowerCase().includes(query);
        if (!nameMatch && !contactMatch) return false;
      }

      // 2. Product Type (Name Selection)
      if (productType && log.product_name !== productType) {
        return false;
      }

      // 3. Payment Method (Cash, Online, Credit)
      if (paymentMethod !== 'All') {
        const dbMethod = log.payment_method?.toLowerCase() || '';
        const selectedMethod = paymentMethod.toLowerCase();
        if (dbMethod !== selectedMethod) return false;
      }

      // 4. Timeframe Presets and Custom Ranges
      if (log.sold_at) {
        const saleDate = new Date(log.sold_at);

        if (timePreset === 'Today') {
          if (now.toDateString() !== saleDate.toDateString()) return false;
        } else if (timePreset === 'This Week') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          if (saleDate < oneWeekAgo) return false;
        } else if (timePreset === 'This Month') {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(now.getMonth() - 1);
          if (saleDate < oneMonthAgo) return false;
        } else if (timePreset === 'Custom') {
          if (startDate) {
            const startLimit = new Date(startDate);
            startLimit.setHours(0, 0, 0, 0);
            if (saleDate < startLimit) return false;
          }
          if (endDate) {
            const endLimit = new Date(endDate);
            endLimit.setHours(23, 59, 59, 999);
            if (saleDate > endLimit) return false;
          }
        }
      }

      // 5. Price / Revenue Range Filter
      const revenue = parseFloat(log.total_revenue || 0);
      if (minPrice !== '' && revenue < parseFloat(minPrice)) return false;
      if (maxPrice !== '' && revenue > parseFloat(maxPrice)) return false;

      return true;
    });
  }, [salesHistory, searchQuery, productType, paymentMethod, timePreset, startDate, endDate, minPrice, maxPrice]);

  // Total summary of filtered records
  const filteredRevenue = useMemo(() => {
    return filteredLogs.reduce((acc, log) => acc + parseFloat(log.total_revenue || 0), 0);
  }, [filteredLogs]);

  // Reset helper
  const handleResetFilters = () => {
    setSearchQuery('');
    setProductType('');
    setPaymentMethod('All');
    setTimePreset('All');
    setStartDate('');
    setEndDate('');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">
            Financial Ledger
          </h1>
          <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">
            audit / chronological_transactions
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs font-mono tracking-tight px-4 py-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
              showFilters 
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' 
                : 'border-zinc-200 dark:border-[#1f1f23] text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {showFilters ? 'Hide Filters' : 'Filter Ledger'}
          </button>

          {refreshReports && (
            <button
              onClick={refreshReports}
              className="text-xs font-mono tracking-tight px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-[#1f1f23] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-700 transition-all cursor-pointer"
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </header>

      {/* COLLAPSIBLE PREMIUM FILTER PANEL */}
      {showFilters && (
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-6 shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] animate-fade-in space-y-6 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Search Customer */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">Customer Search</label>
              <input
                type="text"
                placeholder="Name or Phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono"
              />
            </div>

            {/* Product Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">Product Type</label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono cursor-pointer"
              >
                <option value="">All Products</option>
                {uniqueProducts.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono cursor-pointer"
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Credit">Credit</option>
              </select>
            </div>

            {/* Timeframe Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">Time Period</label>
              <select
                value={timePreset}
                onChange={(e) => setTimePreset(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono cursor-pointer"
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom">Custom Date Range</option>
              </select>
            </div>

          </div>

          {/* Conditional / Secondary Filter Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/50">
            
            {/* Conditional Date Range Picker */}
            {timePreset === 'Custom' ? (
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">Active Date Window</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono"
                  />
                  <span className="text-zinc-400 font-mono text-xs">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="hidden lg:block text-xs font-mono text-zinc-400 self-center">
                Select "Custom Date Range" to input absolute calendar parameters.
              </div>
            )}

            {/* Price (Revenue) Ranges */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">Transaction Value (₹) Range</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min (₹)"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono"
                />
                <span className="text-zinc-400 font-mono text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max (₹)"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white outline-none font-mono"
                />
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleResetFilters}
              className="text-xs font-mono text-red-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              ✕ Clear Active Parameters
            </button>
          </div>
        </div>
      )}

      {/* FILTER METRICS METRICS BAR */}
      {showFilters && (
        <div className="flex justify-between items-center px-4 py-3 bg-zinc-50 dark:bg-[#121214]/50 border border-zinc-200 dark:border-[#1f1f23] rounded-lg text-xs font-mono">
          <span className="text-zinc-500 dark:text-zinc-400">
            Matching Entries: <strong className="text-zinc-900 dark:text-white">{filteredLogs.length}</strong>
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            Filtered Total: <strong className="text-[#10b981]">₹{filteredRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
        </div>
      )}

      {/* LEDGER DISPLAY TABLE CONTAINER */}
      <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl overflow-hidden shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {!isLoaded ? (
            <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm font-mono tracking-tight animate-pulse">
              Syncing ledger...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 dark:text-zinc-500 text-sm font-sans tracking-tight">
              No matching transaction records found
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredLogs.map((log) => (
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
                      +₹{parseFloat(log.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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