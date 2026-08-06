import React, { useState, useMemo } from 'react';

export default function ReportsView({ salesHistory = [], isLoaded = false, refreshReports, token }) {
  // --- FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [productType, setProductType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [timePreset, setTimePreset] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // --- EDIT CONTROL ENGINE STATES ---
  const [editingSale, setEditingSale] = useState(null);
  const [editForm, setEditForm] = useState({ buyer_name: '', contact_number: '', payment_method: 'Cash', payment_status: 'Paid', transportation_fee: 0, items: [], custom_total: undefined });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // --- SETTLE BALANCE MODAL STATES ---
  const [settleTarget, setSettleTarget] = useState(null); // the log record to settle
  const [paymentAmount, setPaymentAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [isSettling, setIsSettling] = useState(false);
  const [showOverpayError, setShowOverpayError] = useState(false);

  const remainingDue = settleTarget ? parseFloat(settleTarget.due_amount || 0) : 0;

  // --- RETURN ITEMS MODAL STATES ---
  const [returnTarget, setReturnTarget] = useState(null); // the log record to return
  const [returnItemQtys, setReturnItemQtys] = useState({}); // { product_id: qty }
  const [returnRefundType, setReturnRefundType] = useState('deduct_due'); // 'deduct_due' | 'refund_cash'
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // --- ACTION ENGINE: OPEN SETTLE MODAL ---
  const handleSettlePayment = (log) => {
    setSettleTarget(log);
    const due = parseFloat(log.due_amount || 0);
    setPaymentAmount(due.toFixed(2));
    setSettleMethod('Cash');
    setShowOverpayError(false);
  };

  // --- ACTION ENGINE: CLAMPED SETTLE AMOUNT INPUT ---
  const handlePaymentChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    if (val > remainingDue) {
      setPaymentAmount(remainingDue); // Cap at max due
      setShowOverpayError(true);
    } else if (val < 0) {
      setPaymentAmount(0);
      setShowOverpayError(false);
    } else {
      setPaymentAmount(val);
      setShowOverpayError(false);
    }
  };

  // --- ACTION ENGINE: EXECUTE SETTLE (from modal) ---
  const handleExecuteSettlement = async () => {
    if (!settleTarget) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || amount > remainingDue + 0.001) {
      alert('Please enter a valid payment amount up to the remaining due balance.');
      return;
    }
    setIsSettling(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/${settleTarget.id}/settle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, payment_method: settleMethod })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettleTarget(null);
        if (refreshReports) await refreshReports();
      } else {
        alert(data.error || 'Failed to settle balance.');
      }
    } catch (err) {
      alert('Network communication error.');
    } finally {
      setIsSettling(false);
    }
  };

  // --- ACTION ENGINE: EXECUTE EDIT ---
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSale) return;
    setIsSavingEdit(true);

    const itemsSubtotal = editForm.items.reduce((acc, item) => acc + item.subtotal, 0);
    const calculatedTotal = itemsSubtotal + (editForm.transportation_fee || 0);
    const finalTotal = editForm.custom_total !== undefined ? editForm.custom_total : calculatedTotal;

    const payload = {
      ...editForm,
      total_amount: finalTotal
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/${editingSale.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingSale(null);
        if (refreshReports) await refreshReports();
      } else {
        alert(data.error || "Execution failed.");
      }
    } catch (err) {
      alert("Network framework error.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- ACTION ENGINE: OPEN RETURN MODAL ---
  const handleOpenReturnModal = (log, parsedItems) => {
    setReturnTarget({ log, parsedItems });
    const initial = {};
    parsedItems.forEach(item => { initial[item.product_id] = 0; });
    setReturnItemQtys(initial);
    const hasDue = parseFloat(log.due_amount || 0) > 0;
    setReturnRefundType(hasDue ? 'deduct_due' : 'refund_cash');
  };

  // --- ACTION ENGINE: EXECUTE RETURN (from modal) ---
  const handleExecuteReturnModal = async () => {
    if (!returnTarget) return;
    const { log, parsedItems } = returnTarget;
    const items = parsedItems
      .filter(item => parseFloat(returnItemQtys[item.product_id] || 0) > 0)
      .map(item => ({ product_id: item.product_id, return_quantity: parseFloat(returnItemQtys[item.product_id]) }));
    if (items.length === 0) { alert('Enter at least one item quantity to return.'); return; }
    setIsProcessingReturn(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/${log.id}/return`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, refund_type: returnRefundType })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReturnTarget(null);
        if (refreshReports) await refreshReports();
      } else {
        alert(data.error || 'Return failed.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const uniqueProducts = useMemo(() => {
    const names = salesHistory.map(s => s.product_name).filter(Boolean);
    return [...new Set(names)].sort();
  }, [salesHistory]);

  const filteredLogs = useMemo(() => {
    const now = new Date();
    return salesHistory.filter((log) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!log.buyer_name?.toLowerCase().includes(query) && !log.buyer_contact?.toLowerCase().includes(query)) return false;
      }
      if (productType && log.product_name !== productType) return false;
      
      if (paymentMethod !== 'All') {
        const dbMethod = log.payment_method?.toLowerCase() || '';
        const selected = paymentMethod.toLowerCase();
        if (selected === 'credit' && !dbMethod.includes('credit')) return false;
        if (selected !== 'credit' && dbMethod !== selected) return false;
      }

      if (paymentStatus !== 'All') {
        const dbStatus = log.payment_status?.toLowerCase() || '';
        const selectedStatus = paymentStatus.toLowerCase();
        if (dbStatus !== selectedStatus) return false;
      }

      if (log.sold_at) {
        const saleDate = new Date(log.sold_at);
        if (timePreset === 'Today' && now.toDateString() !== saleDate.toDateString()) return false;
        if (timePreset === 'This Week') {
          const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7);
          if (saleDate < oneWeekAgo) return false;
        }
        if (timePreset === 'This Month') {
          const oneMonthAgo = new Date(); oneMonthAgo.setMonth(now.getMonth() - 1);
          if (saleDate < oneMonthAgo) return false;
        }
        if (timePreset === 'Custom') {
          if (startDate) { const sL = new Date(startDate); sL.setHours(0,0,0,0); if (saleDate < sL) return false; }
          if (endDate) { const eL = new Date(endDate); eL.setHours(23,59,59,999); if (saleDate > eL) return false; }
        }
      }

      const revenue = parseFloat(log.total_revenue || 0);
      if (minPrice !== '' && revenue < parseFloat(minPrice)) return false;
      if (maxPrice !== '' && revenue > parseFloat(maxPrice)) return false;

      return true;
    });
  }, [salesHistory, searchQuery, productType, paymentMethod, paymentStatus, timePreset, startDate, endDate, minPrice, maxPrice]);

  const filteredRevenue = useMemo(() => {
    return filteredLogs.reduce((acc, log) => acc + parseFloat(log.total_revenue || 0), 0);
  }, [filteredLogs]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">Financial Ledger</h1>
          <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">audit / chronological_transactions</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button onClick={() => setShowFilters(!showFilters)} className={`text-xs font-mono tracking-tight px-4 py-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${showFilters ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'border-zinc-200 dark:border-[#1f1f23] text-zinc-600'}`}>
            Filters
          </button>
          {refreshReports && <button onClick={() => {
            if (refreshReports) refreshReports();
            setSearchQuery('');
            setProductType('');
            setPaymentMethod('All');
            setPaymentStatus('All');
            setTimePreset('All');
            setStartDate('');
            setEndDate('');
            setMinPrice('');
            setMaxPrice('');
          }} className="text-xs font-mono px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-[#1f1f23] text-zinc-500 cursor-pointer">↻ Refresh</button>}
        </div>
      </header>

      {showFilters && (
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-6 text-left space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <input type="text" placeholder="Search Customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border p-2 text-xs rounded-lg font-mono outline-none"/>
            <select value={productType} onChange={(e) => setProductType(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border p-2 text-xs rounded-lg font-mono outline-none">
              <option value="">All Products</option>
              {uniqueProducts.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border p-2 text-xs rounded-lg font-mono outline-none">
              <option value="All">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
              <option value="Credit">Credit/Partial</option>
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border p-2 text-xs rounded-lg font-mono outline-none">
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            <select value={timePreset} onChange={(e) => setTimePreset(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border p-2 text-xs rounded-lg font-mono outline-none">
              <option value="All">All Time</option>
              <option value="Custom">Custom Range</option>
            </select>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl overflow-hidden shadow-sm">
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {!isLoaded ? (
            <div className="p-10 text-center text-zinc-400 text-sm font-mono animate-pulse">Syncing ledger...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-zinc-400 text-sm">No records found</div>
          ) : (
            <div className="flex flex-col">
              {filteredLogs.map((log) => {
                const isCreditRelated = log.payment_method?.toLowerCase().includes('credit') || log.payment_method?.toLowerCase().includes('partial');
                const dueVal = log.due_amount !== undefined && log.due_amount !== null ? parseFloat(log.due_amount) : (log.payment_status === 'Unpaid' ? parseFloat(log.total_revenue || 0) : 0);
                const paidVal = log.paid_amount !== undefined && log.paid_amount !== null ? parseFloat(log.paid_amount) : (log.payment_status === 'Paid' ? parseFloat(log.total_revenue || 0) : 0);
                
                let parsedItems = [];
                if (typeof log.items === 'string') {
                  try { parsedItems = JSON.parse(log.items); } catch(e) {}
                } else if (Array.isArray(log.items)) {
                  parsedItems = log.items;
                }

                const currentQtySold = parsedItems.reduce((acc, item) => acc + (parseFloat(item.quantity_sold || 0) - parseFloat(item.quantity_returned || 0)), 0);
                const isUnpaid = dueVal > 0 && paidVal === 0;
                const isPartial = dueVal > 0 && paidVal > 0;
                
                const productName = parsedItems.length > 0 
                  ? parsedItems.map(i => `${i.product_name || 'Unknown'} (${parseFloat(i.quantity_sold || 0).toFixed(2)} ${i.quantity_unit || 'Piece'})`).join(' + ')
                  : 'Unknown Order Items';

                return (
                  <div 
                    key={log.id} 
                    className={`flex flex-col border-b transition-colors ${
                      isUnpaid 
                        ? 'bg-red-500/10 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 hover:bg-red-500/15 dark:hover:bg-red-950/40' 
                        : isPartial
                          ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 hover:bg-amber-500/15 dark:hover:bg-amber-950/40'
                          : 'border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-white/5'
                    }`}
                  >
                    
                    {/* Primary Row Content Layout */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800/60 gap-4">
                      <div className="flex-1 space-y-1 text-left break-words whitespace-normal">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-medium tracking-tight break-words whitespace-normal ${isUnpaid ? 'text-red-700 dark:text-red-300 font-semibold' : isPartial ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-zinc-900 dark:text-white'}`}>
                            {productName}
                          </span>
                          {dueVal === 0 ? (
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white shadow-sm">
                              PAID
                            </span>
                          ) : isPartial ? (
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-sm">
                              PARTIAL (Paid: ₹{paidVal.toFixed(0)} | Due: ₹{dueVal.toFixed(0)})
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500 text-white shadow-sm">
                              UNPAID (Due: ₹{dueVal.toFixed(0)})
                            </span>
                          )}
                        </div>
                        <span className={`block text-xs font-mono ${isUnpaid ? 'text-red-600/80 dark:text-red-400/80' : isPartial ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-zinc-500'}`}>
                          {log.sold_at ? new Date(log.sold_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {log.buyer_name && (
                          <span className={`block text-xs font-sans ${isUnpaid ? 'text-red-700/80 dark:text-red-300/80 font-medium' : isPartial ? 'text-amber-700/80 dark:text-amber-300/80 font-medium' : 'text-zinc-400'}`}>
                            {log.buyer_name} · {log.buyer_contact || 'No contact'}
                          </span>
                        )}
                        {parseFloat(log.quantity_returned || 0) > 0 && (
                          <span className="block text-[10px] font-mono text-red-500 font-medium mt-0.5">
                            Returned: {parseFloat(log.quantity_returned).toFixed(2)} {parsedItems[0]?.quantity_unit || 'units'}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:items-center items-end justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-200 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center gap-3 text-xs order-2 md:order-1 mt-2 md:mt-0">
                          {dueVal > 0 && (
                            <>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-600 text-white hidden md:inline-block">
                                Due: ₹{dueVal.toFixed(2)}
                              </span>
                              <button 
                                onClick={() => handleSettlePayment(log)}
                                className="text-amber-600 dark:text-amber-500 hover:underline font-medium py-1 px-2 rounded bg-amber-500/10 md:bg-transparent"
                              >
                                Settle Balance
                              </button>
                            </>
                          )}
                          
                          {currentQtySold > 0 && (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingSale(log);
                                  
                                  const mappedItems = parsedItems.map(item => ({
                                    sale_id: item.sale_id,
                                    product_id: item.product_id,
                                    product_name: item.product_name,
                                    quantity: parseFloat(item.quantity_sold),
                                    unit_price: parseFloat(item.quantity_sold) > 0 ? parseFloat(item.total_revenue) / parseFloat(item.quantity_sold) : 0,
                                    unit: item.quantity_unit || 'Piece',
                                    subtotal: parseFloat(item.total_revenue)
                                  }));

                                  const calcTot = mappedItems.reduce((acc, item) => acc + item.subtotal, 0) + (parseFloat(log.transportation_fee) || 0);
                                  const originalTot = parseFloat(log.total_revenue) || 0;
                                  
                                  setEditForm({
                                    buyer_name: log.buyer_name || '',
                                    contact_number: log.buyer_contact || '',
                                    payment_method: log.payment_method || 'Cash',
                                    payment_status: isUnpaid ? 'Unpaid' : 'Paid',
                                    transportation_fee: parseFloat(log.transportation_fee) || 0,
                                    items: mappedItems,
                                    custom_total: Math.abs(originalTot - calcTot) > 0.01 ? originalTot : undefined
                                  });
                                }}
                                className="text-blue-500 hover:underline flex items-center gap-1 py-1 px-2 rounded bg-blue-500/10 md:bg-transparent"
                              >
                                Edit ✏️
                              </button>
                              <button 
                                onClick={() => handleOpenReturnModal(log, parsedItems)}
                                className="text-red-500 hover:underline py-1 px-2 rounded bg-red-500/10 md:bg-transparent"
                              >
                                Return Items
                              </button>
                            </>
                          )}
                        </div>
                        
                        <div className="text-right order-1 md:order-2 flex flex-col items-end w-full md:w-auto">
                          <div className="flex justify-between md:flex-col items-center md:items-end w-full md:w-auto">
                            <span className={`text-xs font-sans ${isUnpaid ? 'text-red-700/80 dark:text-red-300/80' : isPartial ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-zinc-500'}`}>
                              {currentQtySold.toFixed(2)} {log.quantity_unit || 'units'} sold
                            </span>
                            <span className={`px-3 py-1 rounded-md font-mono text-lg font-bold inline-block ${isUnpaid ? 'bg-red-600 text-white shadow-sm' : 'bg-[#10b981]/10 text-[#10b981]'}`}>
                              ₹{(parseFloat(log.total_revenue || 0) - parseFloat(log.amount_refunded || 0)).toFixed(2)}
                            </span>
                          </div>
                          {parseFloat(log.amount_refunded || 0) > 0 && (
                            <span className="text-[9px] font-mono text-red-400 mt-1 block">
                              Refunded: ₹{parseFloat(log.amount_refunded).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SETTLE BALANCE MODAL */}
      {/* ═══════════════════════════════════════════════════ */}
      {settleTarget && (() => {
        const totalAmt = parseFloat(settleTarget.total_amount || settleTarget.total_revenue || 0);
        const paidAmt  = parseFloat(settleTarget.paid_amount  || 0);
        const inputAmt = parseFloat(paymentAmount) || 0;
        const newPaid  = Math.min(paidAmt + inputAmt, totalAmt);
        const newDue   = Math.max(0, totalAmt - newPaid);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#0f0f11] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold text-lg tracking-tight">Settle Balance</h2>
                    <p className="text-red-100 text-xs font-mono mt-0.5">Order #{settleTarget.id} · {settleTarget.buyer_name || 'Unknown Customer'}</p>
                  </div>
                  <button onClick={() => setSettleTarget(null)} className="text-red-100 hover:text-white cursor-pointer transition-colors p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">Total Bill</p>
                    <p className="text-sm font-bold font-mono text-zinc-800 dark:text-zinc-100">₹{totalAmt.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Paid</p>
                    <p className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">₹{paidAmt.toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-mono text-red-500 uppercase tracking-wider mb-1">Due</p>
                    <p className="text-sm font-bold font-mono text-red-600 dark:text-red-400">₹{remainingDue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Settlement Amount Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Settlement Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      max={remainingDue}
                      value={paymentAmount}
                      onChange={handlePaymentChange}
                      className={`w-full pl-8 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border rounded-xl text-sm font-mono text-zinc-900 dark:text-white outline-none transition-all ${
                        showOverpayError
                          ? 'border-red-400 focus:border-red-500 ring-2 ring-red-400/20'
                          : 'border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-red-500/30 focus:border-red-400'
                      }`}
                    />
                  </div>
                  {showOverpayError ? (
                    <p className="text-[11px] font-mono text-red-500 flex items-center gap-1">
                      ⚠️ Maximum payable amount for this balance is ₹{remainingDue}.
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-400 font-mono">Max: ₹{remainingDue.toFixed(2)} remaining</p>
                  )}
                </div>

                {/* Payment Method Toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Payment Method</label>
                  <div className="flex gap-2">
                    {['Cash', 'Online'].map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSettleMethod(method)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-mono font-medium transition-all cursor-pointer border ${
                          settleMethod === method
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                        }`}
                      >
                        {method === 'Cash' ? '💵 Cash' : '📲 Online'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                {inputAmt > 0 && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3">
                    <p className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-medium mb-1">After settlement preview:</p>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-500">New Paid →</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{newPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono mt-0.5">
                      <span className="text-zinc-500">Remaining Due →</span>
                      <span className={`font-bold ${newDue <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>₹{newDue.toFixed(2)} {newDue <= 0 ? '✓ Cleared' : ''}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setSettleTarget(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSettlement}
                    disabled={isSettling || !paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > remainingDue + 0.001}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-red-500/20"
                  >
                    {isSettling ? 'Processing...' : 'Confirm Settlement'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════ */}
      {/* RETURN ITEMS MODAL */}
      {/* ═══════════════════════════════════════════════════ */}
      {returnTarget && (() => {
        const { log, parsedItems } = returnTarget;
        const hasDue = parseFloat(log.due_amount || 0) > 0;
        const totalRefund = parsedItems.reduce((acc, item) => {
          const qty = parseFloat(returnItemQtys[item.product_id] || 0);
          const origQty = parseFloat(item.quantity_sold || 0);
          const unitPrice = origQty > 0 ? parseFloat(item.total_revenue || 0) / origQty : 0;
          return acc + qty * unitPrice;
        }, 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#0f0f11] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-6 py-5 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold text-lg tracking-tight">Return Items</h2>
                    <p className="text-orange-100 text-xs font-mono mt-0.5">Order #{log.id} · {log.buyer_name || 'Unknown Customer'}</p>
                  </div>
                  <button onClick={() => setReturnTarget(null)} className="text-orange-100 hover:text-white cursor-pointer transition-colors p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5">
                {/* Item Table */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    <div className="col-span-4">Product</div>
                    <div className="col-span-3 text-right">Orig Qty</div>
                    <div className="col-span-2 text-right">Unit ₹</div>
                    <div className="col-span-3 text-right">Return Qty</div>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {parsedItems.map((item, idx) => {
                      const origQty = parseFloat(item.quantity_sold || 0);
                      const returnedAlready = parseFloat(item.quantity_returned || 0);
                      const remaining = Math.max(0, origQty - returnedAlready);
                      const unitPrice = origQty > 0 ? parseFloat(item.total_revenue || 0) / origQty : 0;
                      return (
                        <div key={idx} className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm">
                          <div className="col-span-4">
                            <p className="font-medium text-xs text-zinc-800 dark:text-zinc-100 truncate" title={item.product_name}>{item.product_name}</p>
                            <p className="text-[10px] font-mono text-zinc-400">{remaining.toFixed(2)} {item.quantity_unit || 'Piece'} returnable</p>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{origQty.toFixed(2)} {item.quantity_unit || ''}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs font-mono text-zinc-500">₹{unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={remaining}
                              value={returnItemQtys[item.product_id] ?? 0}
                              onChange={e => setReturnItemQtys(prev => ({ ...prev, [item.product_id]: e.target.value }))}
                              className="w-full text-right bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Refund Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Refund Strategy</label>
                  <div className="flex flex-col gap-2">
                    {hasDue && (
                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        returnRefundType === 'deduct_due'
                          ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-300'
                      }`}>
                        <input type="radio" name="refundType" value="deduct_due" checked={returnRefundType === 'deduct_due'} onChange={() => setReturnRefundType('deduct_due')} className="mt-0.5 accent-emerald-500" />
                        <div>
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100">Deduct from Outstanding Balance</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">Reduces the customer's unpaid due balance by the refund value.</p>
                        </div>
                      </label>
                    )}
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      returnRefundType === 'refund_cash'
                        ? 'border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-300'
                    }`}>
                      <input type="radio" name="refundType" value="refund_cash" checked={returnRefundType === 'refund_cash'} onChange={() => setReturnRefundType('refund_cash')} className="mt-0.5 accent-orange-500" />
                      <div>
                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100">Refund Cash / Online to Customer</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Physically hand back ₹{totalRefund.toFixed(2)} to the customer.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Refund Total Banner */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-orange-700 dark:text-orange-300 font-medium">Total Refund / Credit Value</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Σ (Return Qty × Unit Price)</p>
                  </div>
                  <span className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400">₹{totalRefund.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 p-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReturnModal}
                  disabled={isProcessingReturn || totalRefund <= 0}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-orange-500/20"
                >
                  {isProcessingReturn ? 'Processing...' : 'Submit Return'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT MODAL OVERLAY */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-left">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-xl relative custom-scrollbar">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">Edit Sales Record</h3>
              <button onClick={() => setEditingSale(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Buyer Name</label>
                <input 
                  type="text" 
                  value={editForm.buyer_name} 
                  onChange={e => setEditForm({...editForm, buyer_name: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Contact Number</label>
                <input 
                  type="text" 
                  value={editForm.contact_number} 
                  onChange={e => setEditForm({...editForm, contact_number: e.target.value})}
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Payment Method</label>
                  <select 
                    value={editForm.payment_method} 
                    onChange={e => setEditForm({...editForm, payment_method: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Credit / Unpaid">Credit / Unpaid</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Payment Status</label>
                  <select 
                    value={editForm.payment_status} 
                    onChange={e => setEditForm({...editForm, payment_status: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Transportation Charge (₹)</label>
                <input 
                  type="number" 
                  min="0"
                  value={editForm.transportation_fee === 0 ? '' : editForm.transportation_fee}
                  onChange={(e) => {
                    const fee = Math.max(0, parseFloat(e.target.value) || 0);
                    setEditForm({...editForm, transportation_fee: fee});
                  }}
                  placeholder="0"
                  className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none"
                />
              </div>

              {/* Editable Itemized Billing Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 grid grid-cols-12 gap-2">
                  <div className="col-span-4">Item</div>
                  <div className="col-span-3">Qty & Unit</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-48 overflow-y-auto custom-scrollbar">
                  {editForm.items.map((item, idx) => (
                    <div key={idx} className="px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 truncate text-xs" title={item.product_name}>{item.product_name}</div>
                      <div className="col-span-3 flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = parseFloat(e.target.value) || 0;
                            const newItems = [...editForm.items];
                            newItems[idx].quantity = newQty;
                            newItems[idx].subtotal = newQty * newItems[idx].unit_price;
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-14 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs px-1.5 py-1 text-center outline-none"
                        />
                        <span className="text-[10px] text-zinc-500">{item.unit}</span>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value) || 0;
                            const newItems = [...editForm.items];
                            newItems[idx].unit_price = newPrice;
                            newItems[idx].subtotal = newItems[idx].quantity * newPrice;
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs px-1.5 py-1 outline-none"
                        />
                      </div>
                      <div className="col-span-2 text-right text-xs font-mono">
                        ₹{item.subtotal.toFixed(2)}
                      </div>
                      <div className="col-span-1 text-right">
                        <button 
                          type="button" 
                          onClick={() => {
                            const newItems = editForm.items.filter((_, i) => i !== idx);
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          className="text-zinc-400 hover:text-red-500 cursor-pointer transition-colors p-1"
                          title="Remove item"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {editForm.items.length === 0 && (
                    <div className="p-4 text-center text-xs text-zinc-500">No items remaining. Order will be empty.</div>
                  )}
                </div>
              </div>

              {/* Live Grand Total Banner */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-emerald-800 dark:text-emerald-400">Grand Total (₹)</label>
                  {editForm.custom_total !== undefined && editForm.custom_total !== (editForm.items.reduce((acc, item) => acc + item.subtotal, 0) + (editForm.transportation_fee || 0)) && (
                    <span className="text-[10px] bg-emerald-200 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">
                      Price Adjustment
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editForm.custom_total !== undefined ? editForm.custom_total : (editForm.items.reduce((acc, item) => acc + item.subtotal, 0) + (editForm.transportation_fee || 0))}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      setEditForm({...editForm, custom_total: undefined});
                    } else {
                      setEditForm({...editForm, custom_total: Math.max(0, parseFloat(e.target.value) || 0)});
                    }
                  }}
                  className="w-full bg-white dark:bg-[#121214] border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-2 text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 outline-none text-right"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-2">
                <button type="button" onClick={() => setEditingSale(null)} className="flex-1 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingEdit} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}