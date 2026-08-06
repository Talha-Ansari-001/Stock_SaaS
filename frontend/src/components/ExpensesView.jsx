import { useState } from 'react';

export default function ExpensesView({ token, expenses = [], isLoaded = false, refreshExpenses }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Fuel/Transportation');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Mobile Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    } catch {
      alert("Network communication system fault.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🗑️ Delete expense entry
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense entry?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        // Refresh expenses list to reflect deletion
        if (refreshExpenses) await refreshExpenses();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete expense entry.');
      }
    } catch {
      alert('Network error while deleting expense.');
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
  const totalAllTime = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

  // Category colors
  const categoryConfig = {
    'Fuel/Transportation': { color: 'warning', icon: 'bi-fuel-pump', label: 'Fuel & Logistics' },
    'Labour/Wages':        { color: 'brand',   icon: 'bi-people',    label: 'Labour Wages' },
    'Chai/Refreshments':   { color: 'success', icon: 'bi-cup-hot',   label: 'Refreshments' },
    'Office/Miscellaneous':{ color: 'neutral',  icon: 'bi-briefcase', label: 'Miscellaneous' },
  };

  const getCategoryConfig = (cat) => categoryConfig[cat] || { color: 'neutral', icon: 'bi-tag', label: cat };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease both' }}>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense Terminal</h1>
          <p className="page-subtitle">Track and manage business outflows</p>
        </div>
        <div className="page-actions flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>All-Time Outflow</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace', letterSpacing: '-0.02em' }}>
              ₹{totalAllTime.toFixed(2)}
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="md:hidden btn-os danger sm">
            <i className="bi bi-plus-circle me-1" /> Log Expense
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card-modern">
        <div className="card-body-modern" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>

              {/* Category Filter */}
              <div className="form-group" style={{ minWidth: '160px' }}>
                <label className="form-label-modern">Filter Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="form-control-modern form-select-modern"
                  style={{ height: '38px', fontSize: '12.5px' }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="Fuel/Transportation">Fuel & Logistics</option>
                  <option value="Labour/Wages">Manual Labour</option>
                  <option value="Chai/Refreshments">Chai & Refreshments</option>
                  <option value="Office/Miscellaneous">Miscellaneous Outflows</option>
                </select>
              </div>

              {/* Timeframe Filter */}
              <div className="form-group" style={{ minWidth: '150px' }}>
                <label className="form-label-modern">Time Horizon</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="form-control-modern form-select-modern"
                  style={{ height: '38px', fontSize: '12.5px' }}
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="WEEK">This Week</option>
                  <option value="MONTH">This Month</option>
                  <option value="CUSTOM">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Pickers */}
              {timeframe === 'CUSTOM' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', animation: 'fadeIn 0.25s ease both' }}>
                  <div className="form-group">
                    <label className="form-label-modern">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="form-control-modern"
                      style={{ height: '38px', fontSize: '12.5px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label-modern">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="form-control-modern"
                      style={{ height: '38px', fontSize: '12.5px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Filtered Total Widget */}
            <div style={{
              background: 'var(--danger-light)',
              border: '1px solid rgba(234,84,85,0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 16px',
              textAlign: 'right',
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Selected Outflow
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace' }}>
                ₹{totalFilteredAmount.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(234,84,85,0.7)', marginTop: '2px' }}>
                {filteredExpenses.length} / {expenses.length} entries
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ── ADD EXPENSE FORM (Desktop) ── */}
        <div className="hidden md:block card-modern">
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-plus-circle me-2" style={{ color: 'var(--danger)' }} />
                Log Expense
              </h2>
              <p className="card-header-subtitle">Record a new outflow entry</p>
            </div>
          </div>
          <div className="card-body-modern">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div className="form-group">
                <label className="form-label-modern">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Diesel for pickup truck"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-control-modern"
                />
              </div>

              <div className="form-group">
                <label className="form-label-modern">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-control-modern form-select-modern"
                >
                  <option value="Fuel/Transportation">Fuel & Logistics</option>
                  <option value="Labour/Wages">Manual Labour</option>
                  <option value="Chai/Refreshments">Chai & Refreshments</option>
                  <option value="Office/Miscellaneous">Miscellaneous Outflows</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label-modern">Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    fontSize: '14px', pointerEvents: 'none', fontWeight: '600',
                  }}>₹</span>
                  <input
                    type="number"
                    required
                    step="any"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="form-control-modern"
                    style={{ paddingLeft: '28px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label-modern">Notes (Optional)</label>
                <textarea
                  placeholder="Additional context or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="form-control-modern"
                  style={{ minHeight: '72px', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-os danger full"
                style={{ marginTop: '4px' }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Filing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-lg" /> Log Expense
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── EXPENSE LEDGER ── */}
        <div className="card-modern" style={{ overflow: 'hidden' }}>
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-journal-text me-2" style={{ color: 'var(--danger)' }} />
                Expense Ledger
              </h2>
              <p className="card-header-subtitle">Showing {filteredExpenses.length} entries</p>
            </div>
          </div>

          <div style={{ maxHeight: '560px', overflowY: 'auto' }} className="custom-scrollbar">
            {!isLoaded ? (
              <div className="loading-state">
                <div className="spinner-modern" />
                <p className="loading-text">Synchronizing outflows...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="empty-state">
                <i className="bi bi-journal-x empty-state-icon" />
                <p className="empty-state-title">No expense records found</p>
                <p className="empty-state-text">
                  {expenses.length > 0 ? 'Try adjusting your filter criteria' : 'Log your first expense using the form on the left'}
                </p>
              </div>
            ) : (
              filteredExpenses.map((exp) => {
                const config = getCategoryConfig(exp.category);
                return (
                  <div key={exp.id} className="list-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div className={`stat-icon ${config.color}`} style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}>
                        <i className={`bi ${config.icon}`} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.title}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className={`badge-modern ${config.color}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                            {config.label}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {exp.spent_at ? new Date(exp.spent_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }) : ''}
                          </span>
                        </div>
                        {exp.notes && (
                          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '3px 0 0', fontStyle: 'italic' }}>
                            "{exp.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{
                        fontFamily: 'Roboto Mono, monospace', fontSize: '13px', fontWeight: '700',
                        color: 'var(--danger)', background: 'var(--danger-light)',
                        border: '1px solid rgba(234,84,85,0.2)',
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                      }}>
                        −₹{parseFloat(exp.amount).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="btn-os ghost sm"
                        style={{ color: 'var(--danger)', padding: '6px 8px' }}
                        title="Delete expense"
                        aria-label="Delete expense"
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE LOG EXPENSE MODAL ── */}
      {isModalOpen && (
        <div className="modal-backdrop-modern md:hidden">
          <div className="modal-card-modern" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="modal-header-modern" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="modal-title-modern text-danger-os">
                  <i className="bi bi-lightning-charge-fill me-2" />
                  Log New Expense
                </h3>
                <p className="modal-subtitle-modern">Record a new workspace outflow</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn-os ghost sm"><i className="bi bi-x-lg" /></button>
            </div>
            <form onSubmit={async (e) => { await handleSubmit(e); setIsModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label-modern">Expense Title</label>
                <input type="text" placeholder="e.g. Diesel for Truck" required value={title} onChange={(e) => setTitle(e.target.value)} className="form-control-modern" />
              </div>
              <div className="form-group">
                <label className="form-label-modern">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-control-modern form-select-modern">
                  <option value="Fuel/Transportation">Fuel & Transportation</option>
                  <option value="Labour/Wages">Labour & Wages</option>
                  <option value="Chai/Refreshments">Chai & Refreshments</option>
                  <option value="Office/Miscellaneous">Office / Miscellaneous</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label-modern">Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>₹</span>
                  <input type="number" required min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="form-control-modern" style={{ paddingLeft: '28px', fontSize: '18px', fontWeight: '700', fontFamily: 'Roboto Mono, monospace' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label-modern">Additional Notes <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>(Optional)</span></label>
                <textarea rows="2" placeholder="Any details..." value={notes} onChange={(e) => setNotes(e.target.value)} className="form-control-modern" style={{ resize: 'none' }} />
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-os danger full" style={{ marginTop: '8px' }}>
                {isSubmitting ? 'Committing...' : <><i className="bi bi-check-circle-fill me-2" /> Log Expense</>}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .expenses-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}