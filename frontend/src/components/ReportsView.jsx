import React, { useState, useMemo } from 'react';

export default function ReportsView({ salesHistory = [], isLoaded = false, refreshReports, token }) {
  // --- FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [productType, setProductType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [timePreset, setTimePreset] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // --- RETURN CONTROL ENGINE STATES ---
  const [activeReturnId, setActiveReturnId] = useState(null);
  const [returnQty, setReturnQty] = useState('');
  const [returnUnit, setReturnUnit] = useState('Kg');
  const [refundCash, setRefundCash] = useState(false);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // --- ACTION ENGINE: SETTLE CREDIT ---
  const handleSettlePayment = async (saleId) => {
    if (!window.confirm("Confirm clearing out the remaining balance for this client?")) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/${saleId}/settle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (refreshReports) refreshReports();
      } else {
        alert(data.error || "Failed to settle balance.");
      }
    } catch (err) {
      alert("Network communication error.");
    }
  };

  // --- ACTION ENGINE: EXECUTE QUANTITY RETURN ---
  const handleExecuteReturn = async (log, maxQty, refundValuation) => {
    const qty = parseFloat(returnQty);
    if (!qty || qty <= 0 || qty > maxQty) {
      alert(`Please enter a valid return quantity up to ${maxQty.toFixed(2)}.`);
      return;
    }

    let messagePrompt = `Confirm returning ${qty} ${returnUnit}? This will adjust inventory and recalculate financials.`;
    const isCashRefund = refundCash || log.payment_method?.toLowerCase() === 'cash';
    
    if (isCashRefund) {
      messagePrompt = `Confirm returning ${qty} ${returnUnit}? This requires a physical CASH refund of ₹${refundValuation.toFixed(2)} to the customer.`;
    } else {
      messagePrompt = `Confirm returning ${qty} ${returnUnit}? This will automatically shrink the client's outstanding credit debt by ₹${refundValuation.toFixed(2)}.`;
    }

    if (!window.confirm(messagePrompt)) return;

    setIsProcessingReturn(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/${log.id}/return`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returned_quantity: qty,
          quantity_unit: returnUnit,
          refund_cash: refundCash
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setActiveReturnId(null);
        setReturnQty('');
        setRefundCash(false);
        if (refreshReports) await refreshReports();
      } else {
        alert(data.error || "Execution failed.");
      }
    } catch (err) {
      alert("Network framework error.");
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
  }, [salesHistory, searchQuery, productType, paymentMethod, timePreset, startDate, endDate, minPrice, maxPrice]);

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
          {refreshReports && <button onClick={refreshReports} className="text-xs font-mono px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-[#1f1f23] text-zinc-500 cursor-pointer">↻ Refresh</button>}
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
                const collectionGap = parseFloat(log.total_revenue || 0) - parseFloat(log.amount_paid || 0) - parseFloat(log.amount_refunded || 0);
                const currentQtySold = parseFloat(log.quantity_sold || 0) - parseFloat(log.quantity_returned || 0);

                return (
                  <div key={log.id} className="flex flex-col border-b border-zinc-100 dark:border-zinc-800/60 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5">
                    
                    {/* Primary Row Content Layout */}
                    <div className="flex items-center justify-between p-5">
                      <div className="flex flex-col gap-1 text-left">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white tracking-tight">{log.product_name || 'Unknown Item'}</span>
                        <span className="text-xs font-mono text-zinc-500">
                          {log.sold_at ? new Date(log.sold_at).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {log.buyer_name && <span className="text-xs font-sans text-zinc-400">{log.buyer_name} · {log.buyer_contact || 'No contact'}</span>}
                        {parseFloat(log.quantity_returned || 0) > 0 && (
                          <span className="text-[10px] font-mono text-red-500 font-medium">
                            Returned: {parseFloat(log.quantity_returned).toFixed(2)} {log.quantity_unit}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:flex flex-col items-end justify-center">
                          <span className="text-xs font-sans text-zinc-500">
                            {currentQtySold.toFixed(2)} {log.quantity_unit || 'units'} sold
                          </span>
                          
                          <div className="flex items-center gap-2 mt-1">
                            {isCreditRelated && collectionGap > 0 && (
                              <>
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  Due: ₹{collectionGap.toFixed(2)}
                                </span>
                                <button 
                                  onClick={() => handleSettlePayment(log.id)}
                                  className="text-[10px] font-mono text-zinc-400 hover:text-emerald-500 underline cursor-pointer"
                                >
                                  Settle Balance
                                </button>
                                <span className="text-zinc-300 dark:text-zinc-700 text-xs">·</span>
                              </>
                            )}
                            
                            {/* Hide return triggers if the order item inventory is already completely refunded */}
                            {currentQtySold > 0 && (
                              <button 
                                onClick={() => {
                                  setActiveReturnId(activeReturnId === log.id ? null : log.id);
                                  setReturnQty('');
                                }}
                                className="text-[10px] font-mono text-zinc-400 hover:text-red-500 underline cursor-pointer"
                              >
                                {activeReturnId === log.id ? 'Cancel' : 'Return Items'}
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end justify-center">
                          <span className={`px-2.5 py-1 rounded-md font-mono text-sm font-medium ${isCreditRelated ? 'bg-amber-500/10 text-amber-500' : 'bg-[#10b981]/10 text-[#10b981]'}`}>
                            ₹{(parseFloat(log.total_revenue || 0) - parseFloat(log.amount_refunded || 0)).toFixed(2)}
                          </span>
                          {parseFloat(log.amount_refunded || 0) > 0 && (
                            <span className="text-[9px] font-mono text-red-400 mt-1">
                              Refunded: ₹{parseFloat(log.amount_refunded).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline Return Form Drawer Panel */}
                    {activeReturnId === log.id && (() => {
                      const kg_per_unit = parseFloat(log.kg_per_unit) || 1.00;
                      const originalQty = parseFloat(log.quantity_sold);
                      const returnedQty = parseFloat(log.quantity_returned || 0);
                      const remainingQty = originalQty - returnedQty;
                      const originalRevenue = parseFloat(log.total_revenue);

                      // Calculate max returnable quantity in the selected return unit
                      let maxQtyInSelectedUnit = remainingQty;
                      if (log.quantity_unit !== returnUnit) {
                        if (log.quantity_unit === 'Kg' && returnUnit === 'Bags') {
                          maxQtyInSelectedUnit = remainingQty / kg_per_unit;
                        } else if (log.quantity_unit === 'Bags' && returnUnit === 'Kg') {
                          maxQtyInSelectedUnit = remainingQty * kg_per_unit;
                        }
                      }

                      // Calculate live valuation of the returned amount
                      const inputQtyVal = parseFloat(returnQty || 0);
                      let qtyInSaleUnit = inputQtyVal;
                      if (log.quantity_unit !== returnUnit) {
                        if (log.quantity_unit === 'Kg' && returnUnit === 'Bags') {
                          qtyInSaleUnit = inputQtyVal * kg_per_unit;
                        } else if (log.quantity_unit === 'Bags' && returnUnit === 'Kg') {
                          qtyInSaleUnit = inputQtyVal / kg_per_unit;
                        }
                      }
                      const estValuation = (originalRevenue / originalQty) * qtyInSaleUnit;

                      return (
                        <div className="px-5 pb-5 animate-fade-in border-t border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                            
                            {/* Left: Input details */}
                            <div className="space-y-2">
                              <label className="text-xs font-mono text-zinc-500 dark:text-zinc-400 block font-medium">Return Quantity</label>
                              <div className="flex gap-2">
                                <input 
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  max={maxQtyInSelectedUnit}
                                  placeholder={`Max ${maxQtyInSelectedUnit.toFixed(2)}`}
                                  value={returnQty}
                                  onChange={(e) => setReturnQty(e.target.value)}
                                  className="flex-1 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 text-xs font-mono px-3 py-2 rounded-lg text-zinc-950 dark:text-white outline-none"
                                />
                                <select 
                                  value={returnUnit}
                                  onChange={(e) => {
                                    setReturnUnit(e.target.value);
                                    setReturnQty(''); // clear input to avoid out of bounds
                                  }}
                                  className="w-24 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 text-xs font-mono px-2 py-2 rounded-lg text-zinc-950 dark:text-white outline-none cursor-pointer"
                                >
                                  <option value="Kg">Kg</option>
                                  <option value="Bags">Bags</option>
                                </select>
                              </div>
                              <span className="text-[10px] font-sans text-zinc-400 block">
                                Remaining returnable: {remainingQty.toFixed(2)} {log.quantity_unit} (Ratio: 1 Bag = {kg_per_unit} Kg)
                              </span>
                            </div>

                            {/* Middle: Settlement type & Cash Refund options */}
                            <div className="space-y-2 flex flex-col justify-center">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox"
                                  id={`refundCash-${log.id}`}
                                  checked={refundCash}
                                  onChange={(e) => setRefundCash(e.target.checked)}
                                  className="rounded border-zinc-300 text-red-500 focus:ring-red-500 w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor={`refundCash-${log.id}`} className="text-xs font-sans text-zinc-700 dark:text-zinc-300 font-medium cursor-pointer">
                                  Handout Cash Refund
                                </label>
                              </div>
                              <span className="text-[10px] font-sans text-zinc-400 block pl-6">
                                If unchecked, returned value scales down outstanding credit liabilities first.
                              </span>
                            </div>

                            {/* Right: Valuation summary & submit */}
                            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 flex flex-col justify-between">
                              <div className="flex justify-between items-center text-xs font-sans">
                                <span className="text-zinc-500">Refund Valuation:</span>
                                <span className="font-mono font-bold text-red-500">₹{isNaN(estValuation) ? '0.00' : estValuation.toFixed(2)}</span>
                              </div>
                              
                              <div className="flex gap-2 mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReturnId(null);
                                    setReturnQty('');
                                  }}
                                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-xs py-2 rounded-lg transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExecuteReturn(log, maxQtyInSelectedUnit, estValuation)}
                                  disabled={isProcessingReturn || !returnQty || parseFloat(returnQty) <= 0 || parseFloat(returnQty) > maxQtyInSelectedUnit}
                                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-mono text-xs py-2 rounded-lg transition-all cursor-pointer"
                                >
                                  {isProcessingReturn ? 'Processing...' : 'Confirm Return'}
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })()}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}