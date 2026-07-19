import React, { useState } from 'react';

export default function ExpensesView({ token, expenses = [], isLoaded = false, refreshExpenses }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Fuel/Transportation');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🎛️ FILTER STATES
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [timeframe, setTimeframe] = useState('ALL'); // ALL, TODAY, WEEK, MONTH, CUSTOM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please check entry form variables details.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          amount: parsedAmount,
          notes: notes.trim() || null
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setTitle('');
        setAmount('');
        setNotes('');
        if (refreshExpenses) await refreshExpenses();
      } else {
        alert(data.error || "Failed to commit debit entries.");
      }
    } catch (err) {
      alert("Network communication system fault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ⚡ HIGH-PERFORMANCE DETERMINISTIC FILTERING ENGINE
  const filteredExpenses = expenses.filter((exp) => {
    // 1. Category Filter Match
    if (filterCategory !== 'ALL' && exp.category !== filterCategory) {
      return false;
    }

    // 2. Timeframe / Date Range Filter Match
    if (timeframe === 'ALL') return true;
    if (!exp.spent_at) return false;

    const expenseDate = new Date(exp.spent_at);
    const now = new Date();

    switch (timeframe) {
      case 'TODAY': {
        return expenseDate.toDateString() === now.toDateString();
      }
      case 'WEEK': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        return expenseDate >= startOfWeek;
      }
      case 'MONTH': {
        return (
          expenseDate.getMonth() === now.getMonth() &&
          expenseDate.getFullYear() === now.getFullYear()
        );
      }
      case 'CUSTOM': {
        if (!startDate) return true; // If no start date chosen yet, don't clip records
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        return expenseDate >= start && expenseDate <= end;
      }
      default:
        return true;
    }
  });

  // Calculate dynamic filtered sum
  const totalFilteredAmount = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-center justify-between">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">Expense Terminal</h1>
          <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">logistics / workspace_outflows</p>
        </div>
      </header>

      {/* 📊 GLOBAL LIVE FILTER CONTROL DOCK */}
      <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Category Dropdown Filter */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block">Filter Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2 text-xs rounded-lg font-mono text-zinc-900 dark:text-white outline-none cursor-pointer focus:border-zinc-400 dark:focus:border-zinc-700"
            >
              <option value="ALL">All Categories</option>
              <option value="Fuel/Transportation">Fuel & Logistics</option>
              <option value="Labour/Wages">Manual Labour</option>
              <option value="Chai/Refreshments">Chai & Refreshments</option>
              <option value="Office/Miscellaneous">Miscellaneous Outflows</option>
            </select>
          </div>

          {/* Timeframe Select Filter */}
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block">Time Horizon</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2 text-xs rounded-lg font-mono text-zinc-900 dark:text-white outline-none cursor-pointer focus:border-zinc-400 dark:focus:border-zinc-700"
            >
              <option value="ALL">All Time History</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">This Week</option>
              <option value="MONTH">This Month</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* Inline Custom Date Pickers Matrix */}
          {timeframe === 'CUSTOM' && (
            <div className="flex items-center gap-2 animate-fade-in text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-1.5 text-xs rounded-lg font-mono text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-1.5 text-xs rounded-lg font-mono text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-700"
                />
              </div>
            </div>
          )}
        </div>

        {/* Aggregate Output Metric Widget */}
        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 p-2.5 px-4 rounded-xl text-right shrink-0">
          <span className="text-[10px] font-mono text-zinc-400 uppercase block font-medium">Selected Total Outflow</span>
          <span className="text-base font-mono font-bold text-red-500 dark:text-red-400">
            ₹{totalFilteredAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form Drawer Input Panel */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-5 shadow-sm">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-4 text-left font-semibold">Log New Outflow</h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-medium">Expense Profile</label>
              <input 
                type="text" 
                required
                placeholder="e.g., Diesel for pickup truck, Chai for loaders" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2.5 text-xs rounded-lg font-mono outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-medium">Category Group</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2.5 text-xs rounded-lg font-mono outline-none text-zinc-900 dark:text-white cursor-pointer focus:border-zinc-400 dark:focus:border-zinc-700"
              >
                <option value="Fuel/Transportation">Fuel & Logistics</option>
                <option value="Labour/Wages">Manual Labour</option>
                <option value="Chai/Refreshments">Chai & Refreshments</option>
                <option value="Office/Miscellaneous">Miscellaneous Outflows</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-medium">Outflow Amount (₹)</label>
              <input 
                type="number" 
                required
                step="any"
                min="0.01"
                placeholder="0.00" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2.5 text-xs rounded-lg font-mono outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-medium">Additional Context (Notes)</label>
              <textarea 
                placeholder="Optional situational logs..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2.5 text-xs rounded-lg font-mono h-20 outline-none text-zinc-900 dark:text-white resize-none focus:border-zinc-400 dark:focus:border-zinc-700" 
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 font-mono text-xs py-2.5 rounded-lg transition-all font-semibold tracking-tight disabled:opacity-40 cursor-pointer"
            >
              {isSubmitting ? "Filing Record..." : "Execute Expense Entry"}
            </button>
          </form>
        </div>

        {/* Ledger Activity History Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/20">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">Workspace Ledger Entries</h2>
            <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
              Showing: {filteredExpenses.length} / {expenses.length}
            </span>
          </div>

          <div className="overflow-y-auto max-h-[510px] custom-scrollbar divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {!isLoaded ? (
              <div className="p-12 text-center text-zinc-400 text-xs font-mono animate-pulse">Synchronizing active outflows...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 text-xs font-mono">No matching records found for this filter specification.</div>
            ) : (
              filteredExpenses.map((exp) => (
                <div key={exp.id} className="p-4 flex justify-between items-center hover:bg-zinc-50/40 dark:hover:bg-white/5 transition-colors">
                  <div className="text-left space-y-1 pr-4">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white tracking-tight leading-none">{exp.title}</p>
                    <div className="flex gap-2 items-center">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded uppercase font-medium">
                        {exp.category}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {exp.spent_at ? new Date(exp.spent_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    {exp.notes && <p className="text-xs text-zinc-400 dark:text-zinc-500 font-sans italic mt-1">"{exp.notes}"</p>}
                  </div>
                  <span className="font-mono text-xs font-medium text-red-500 dark:text-red-400 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-md shrink-0">
                    - ₹{parseFloat(exp.amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}