import { useState, useMemo } from 'react';

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
  const [settleTarget, setSettleTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [isSettling, setIsSettling] = useState(false);
  const [showOverpayError, setShowOverpayError] = useState(false);

  const remainingDue = settleTarget ? parseFloat(settleTarget.due_amount || 0) : 0;

  // --- RETURN ITEMS MODAL STATES ---
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnItemQtys, setReturnItemQtys] = useState({});
  const [returnRefundType, setReturnRefundType] = useState('deduct_due');
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
      setPaymentAmount(remainingDue);
      setShowOverpayError(true);
    } else if (val < 0) {
      setPaymentAmount(0);
      setShowOverpayError(false);
    } else {
      setPaymentAmount(val === 0 && e.target.value === '' ? '' : val);
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
    } catch {
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
    } catch {
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
    } catch {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease both' }}>
      
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Ledger</h1>
          <p className="page-subtitle">Chronological record of all sales transactions</p>
        </div>
        <div className="page-actions">
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`btn-os ${showFilters ? 'primary' : 'outline'}`}
          >
            <i className="bi bi-funnel" /> Filters
          </button>
          {refreshReports && (
            <button 
              onClick={() => {
                if (refreshReports) refreshReports();
                setSearchQuery(''); setProductType(''); setPaymentMethod('All');
                setPaymentStatus('All'); setTimePreset('All'); setStartDate(''); setEndDate('');
                setMinPrice(''); setMaxPrice('');
              }} 
              className="btn-os ghost"
            >
              <i className="bi bi-arrow-clockwise" /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="card-modern animate-fade-in">
          <div className="card-body-modern" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label className="form-label-modern">Search Customer</label>
                <div style={{ position: 'relative' }}>
                  <i className="bi bi-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Search name/phone..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="form-control-modern"
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>
              
              <div className="form-group" style={{ flex: '1 1 160px' }}>
                <label className="form-label-modern">Product Filter</label>
                <select value={productType} onChange={(e) => setProductType(e.target.value)} className="form-control-modern form-select-modern">
                  <option value="">All Products</option>
                  {uniqueProducts.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label className="form-label-modern">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="form-control-modern form-select-modern">
                  <option value="All">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                  <option value="Credit">Credit/Partial</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 140px' }}>
                <label className="form-label-modern">Payment Status</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="form-control-modern form-select-modern">
                  <option value="All">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: '1 1 160px' }}>
                <label className="form-label-modern">Time Range</label>
                <select value={timePreset} onChange={(e) => setTimePreset(e.target.value)} className="form-control-modern form-select-modern">
                  <option value="All">All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                  <option value="Custom">Custom Range</option>
                </select>
              </div>

              {timePreset === 'Custom' && (
                <div style={{ display: 'flex', gap: '8px', flex: '1 1 240px', animation: 'fadeIn 0.2s ease both' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label-modern">From</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-control-modern" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label-modern">To</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-control-modern" />
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {filteredLogs.length} records found matching filters
              </span>
              <div style={{ fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Filtered Revenue:</span>
                <span style={{ marginLeft: '8px', fontSize: '16px', fontWeight: '700', fontFamily: 'Roboto Mono, monospace', color: 'var(--brand)' }}>
                  ₹{filteredRevenue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table / List */}
      <div className="card-modern" style={{ overflow: 'hidden' }}>
        <div style={{ maxHeight: '640px', overflowY: 'auto' }} className="custom-scrollbar">
          {!isLoaded ? (
            <div className="loading-state">
              <div className="spinner-modern" />
              <p className="loading-text">Synchronizing ledger...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state">
              <i className="bi bi-search empty-state-icon" />
              <p className="empty-state-title">No records found</p>
              <p className="empty-state-text">Try adjusting your filter criteria</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredLogs.map((log) => {
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
                  ? parsedItems.map(i => `${i.product_name || 'Unknown'} (${parseFloat(i.quantity_sold || 0).toFixed(2)} ${i.quantity_unit || 'Unit'})`).join(' + ')
                  : 'Unknown Order Items';

                const statusBg = isUnpaid ? 'var(--danger-light)' : isPartial ? 'var(--warning-light)' : 'transparent';
                
                return (
                  <div key={log.id} className="list-row" style={{ backgroundColor: statusBg, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
                      
                      {/* Left: Info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: isUnpaid ? 'var(--danger)' : isPartial ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {productName}
                          </span>
                          
                          {dueVal === 0 ? (
                            <span className="badge-modern success">PAID</span>
                          ) : isPartial ? (
                            <span className="badge-modern warning">PARTIAL (Due: ₹{dueVal.toFixed(0)})</span>
                          ) : (
                            <span className="badge-modern danger">UNPAID (Due: ₹{dueVal.toFixed(0)})</span>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          <span>
                            <i className="bi bi-clock me-1" />
                            {log.sold_at ? new Date(log.sold_at).toLocaleString('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          {log.buyer_name && (
                            <span>
                              <i className="bi bi-person me-1" />
                              {log.buyer_name} {log.buyer_contact ? `(${log.buyer_contact})` : ''}
                            </span>
                          )}
                        </div>
                        
                        {parseFloat(log.quantity_returned || 0) > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '500', marginTop: '2px' }}>
                            <i className="bi bi-arrow-return-left me-1" />
                            Returned: {parseFloat(log.quantity_returned).toFixed(2)} units
                          </div>
                        )}
                      </div>
                      
                      {/* Middle: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {dueVal > 0 && (
                          <button 
                            onClick={() => handleSettlePayment(log)}
                            className="btn-os warning sm"
                          >
                            Settle Balance
                          </button>
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
                                  buyer_name: log.buyer_name || '', contact_number: log.buyer_contact || '',
                                  payment_method: log.payment_method || 'Cash', payment_status: isUnpaid ? 'Unpaid' : 'Paid',
                                  transportation_fee: parseFloat(log.transportation_fee) || 0, items: mappedItems,
                                  custom_total: Math.abs(originalTot - calcTot) > 0.01 ? originalTot : undefined
                                });
                              }}
                              className="btn-os ghost sm" title="Edit Record"
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button 
                              onClick={() => handleOpenReturnModal(log, parsedItems)}
                              className="btn-os ghost sm" style={{ color: 'var(--danger)' }} title="Process Return"
                            >
                              <i className="bi bi-arrow-counterclockwise" />
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Right: Totals */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '120px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          {currentQtySold.toFixed(2)} {log.quantity_unit || 'units'}
                        </div>
                        <span style={{ 
                          fontSize: '18px', fontWeight: '800', fontFamily: 'Roboto Mono, monospace', 
                          color: isUnpaid ? 'var(--danger)' : isPartial ? 'var(--warning)' : 'var(--success)'
                        }}>
                          ₹{(parseFloat(log.total_revenue || 0) - parseFloat(log.amount_refunded || 0)).toFixed(2)}
                        </span>
                        {parseFloat(log.amount_refunded || 0) > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px', fontFamily: 'Roboto Mono, monospace' }}>
                            Refunded: ₹{parseFloat(log.amount_refunded).toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SETTLE BALANCE MODAL ── */}
      {settleTarget && (() => {
        const totalAmt = parseFloat(settleTarget.total_amount || settleTarget.total_revenue || 0);
        const paidAmt  = parseFloat(settleTarget.paid_amount  || 0);
        const inputAmt = parseFloat(paymentAmount) || 0;
        const newPaid  = Math.min(paidAmt + inputAmt, totalAmt);
        const newDue   = Math.max(0, totalAmt - newPaid);
        return (
          <div className="modal-backdrop-modern">
            <div className="modal-card-modern">
              <div className="modal-header-modern">
                <h3 className="modal-title-modern text-warning-os">
                  <i className="bi bi-wallet2 me-2" />
                  Settle Balance
                </h3>
                <p className="modal-subtitle-modern">Order #{settleTarget.id} · {settleTarget.buyer_name}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Bill</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'Roboto Mono, monospace' }}>₹{totalAmt.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--success-light)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--success)' }}>Paid</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)', fontFamily: 'Roboto Mono, monospace' }}>₹{paidAmt.toFixed(2)}</div>
                </div>
                <div style={{ background: 'var(--danger-light)', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--danger)' }}>Due</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--danger)', fontFamily: 'Roboto Mono, monospace' }}>₹{remainingDue.toFixed(2)}</div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label-modern">Settlement Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: '600' }}>₹</span>
                  <input
                    type="number" step="any" min="0.01" max={remainingDue}
                    value={paymentAmount} onChange={handlePaymentChange}
                    className={`form-control-modern ${showOverpayError ? 'error' : ''}`}
                    style={{ paddingLeft: '28px' }}
                  />
                </div>
                {showOverpayError && (
                  <p style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>Cannot exceed ₹{remainingDue}</p>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label-modern">Payment Method</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['Cash', 'Online'].map(method => (
                    <button
                      key={method} type="button" onClick={() => setSettleMethod(method)}
                      className={`btn-os ${settleMethod === method ? 'primary' : 'outline'}`}
                      style={{ flex: 1 }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {inputAmt > 0 && (
                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>New Remaining Due</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'Roboto Mono, monospace', color: newDue <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ₹{newDue.toFixed(2)} {newDue <= 0 && <i className="bi bi-check-circle-fill ms-1" />}
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-actions-modern">
                <button type="button" onClick={() => setSettleTarget(null)} className="btn-os outline full">Cancel</button>
                <button type="button" onClick={handleExecuteSettlement} disabled={isSettling || !paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > remainingDue + 0.001} className="btn-os warning full">
                  {isSettling ? 'Processing...' : 'Confirm Settlement'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── RETURN ITEMS MODAL ── */}
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
          <div className="modal-backdrop-modern">
            <div className="modal-card-modern" style={{ maxWidth: '520px' }}>
              <div className="modal-header-modern">
                <h3 className="modal-title-modern text-danger-os">
                  <i className="bi bi-arrow-return-left me-2" />
                  Return Items
                </h3>
                <p className="modal-subtitle-modern">Order #{log.id} · {log.buyer_name}</p>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                <table className="table-modern" style={{ margin: 0 }}>
                  <thead style={{ background: 'var(--bg-surface)' }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>Item</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit ₹</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', width: '120px' }}>Return Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.map((item, idx) => {
                      const origQty = parseFloat(item.quantity_sold || 0);
                      const returnedAlready = parseFloat(item.quantity_returned || 0);
                      const remaining = Math.max(0, origQty - returnedAlready);
                      const unitPrice = origQty > 0 ? parseFloat(item.total_revenue || 0) / origQty : 0;
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>{item.product_name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{remaining.toFixed(2)} max</div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'Roboto Mono, monospace', fontSize: '12px' }}>
                            ₹{unitPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="number" step="any" min="0" max={remaining}
                              value={returnItemQtys[item.product_id] ?? 0}
                              onChange={e => setReturnItemQtys(prev => ({ ...prev, [item.product_id]: e.target.value }))}
                              className="form-control-modern" style={{ textAlign: 'right', padding: '6px' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label-modern">Refund Strategy</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hasDue && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1.5px solid var(--border)', borderRadius: '10px', cursor: 'pointer', background: returnRefundType === 'deduct_due' ? 'var(--brand-light)' : 'transparent', borderColor: returnRefundType === 'deduct_due' ? 'var(--brand)' : 'var(--border)' }}>
                      <input type="radio" value="deduct_due" checked={returnRefundType === 'deduct_due'} onChange={() => setReturnRefundType('deduct_due')} style={{ accentColor: 'var(--brand)' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Deduct from Outstanding Due</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reduces the customer's unpaid balance.</div>
                      </div>
                    </label>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: '1.5px solid var(--border)', borderRadius: '10px', cursor: 'pointer', background: returnRefundType === 'refund_cash' ? 'var(--danger-light)' : 'transparent', borderColor: returnRefundType === 'refund_cash' ? 'var(--danger)' : 'var(--border)' }}>
                    <input type="radio" value="refund_cash" checked={returnRefundType === 'refund_cash'} onChange={() => setReturnRefundType('refund_cash')} style={{ accentColor: 'var(--danger)' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Refund Cash / Online</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Physically hand back ₹{totalRefund.toFixed(2)} to customer.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Total Refund Value</span>
                <span style={{ fontSize: '20px', fontWeight: '800', fontFamily: 'Roboto Mono, monospace', color: 'var(--danger)' }}>₹{totalRefund.toFixed(2)}</span>
              </div>

              <div className="modal-actions-modern">
                <button type="button" onClick={() => setReturnTarget(null)} className="btn-os outline full">Cancel</button>
                <button type="button" onClick={handleExecuteReturnModal} disabled={isProcessingReturn || totalRefund <= 0} className="btn-os danger full">
                  {isProcessingReturn ? 'Processing...' : 'Submit Return'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EDIT MODAL OVERLAY ── */}
      {editingSale && (
        <div className="modal-backdrop-modern">
          <div className="modal-card-modern" style={{ maxWidth: '480px' }}>
            <div className="modal-header-modern" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 className="modal-title-modern"><i className="bi bi-pencil-square me-2" />Edit Record</h3>
                <p className="modal-subtitle-modern">Update order #{editingSale.id}</p>
              </div>
              <button onClick={() => setEditingSale(null)} className="btn-os ghost sm" style={{ alignSelf: 'flex-start' }}><i className="bi bi-x-lg" /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label-modern">Buyer Name</label>
                  <input type="text" value={editForm.buyer_name} onChange={e => setEditForm({...editForm, buyer_name: e.target.value})} className="form-control-modern" />
                </div>
                <div className="form-group">
                  <label className="form-label-modern">Contact Number</label>
                  <input type="text" value={editForm.contact_number} onChange={e => setEditForm({...editForm, contact_number: e.target.value})} className="form-control-modern" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label-modern">Payment Method</label>
                  <select value={editForm.payment_method} onChange={e => setEditForm({...editForm, payment_method: e.target.value})} className="form-control-modern form-select-modern">
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Credit / Unpaid">Credit / Unpaid</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label-modern">Payment Status</label>
                  <select value={editForm.payment_status} onChange={e => setEditForm({...editForm, payment_status: e.target.value})} className="form-control-modern form-select-modern">
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label-modern">Transportation Charge (₹)</label>
                <input type="number" min="0" value={editForm.transportation_fee === 0 ? '' : editForm.transportation_fee} onChange={(e) => setEditForm({...editForm, transportation_fee: Math.max(0, parseFloat(e.target.value) || 0)})} className="form-control-modern" />
              </div>

              {/* Itemized Billing Table */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '6px 10px', display: 'grid', gridTemplateColumns: '3fr 2fr 2fr 2fr 24px', gap: '8px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  <div>Item</div>
                  <div>Qty</div>
                  <div>Price</div>
                  <div style={{ textAlign: 'right' }}>Total</div>
                  <div></div>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {editForm.items.map((item, idx) => (
                    <div key={idx} style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '3fr 2fr 2fr 2fr 24px', gap: '8px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.product_name}>{item.product_name}</div>
                      <div>
                        <input type="number" step="any" min="0.01" value={item.quantity} onChange={(e) => {
                          const newQty = parseFloat(e.target.value) || 0;
                          const newItems = [...editForm.items];
                          newItems[idx].quantity = newQty;
                          newItems[idx].subtotal = newQty * newItems[idx].unit_price;
                          setEditForm({ ...editForm, items: newItems });
                        }} className="form-control-modern" style={{ padding: '4px', fontSize: '12px' }} />
                      </div>
                      <div>
                        <input type="number" step="any" min="0" value={item.unit_price} onChange={(e) => {
                          const newPrice = parseFloat(e.target.value) || 0;
                          const newItems = [...editForm.items];
                          newItems[idx].unit_price = newPrice;
                          newItems[idx].subtotal = newItems[idx].quantity * newPrice;
                          setEditForm({ ...editForm, items: newItems });
                        }} className="form-control-modern" style={{ padding: '4px', fontSize: '12px' }} />
                      </div>
                      <div style={{ fontSize: '12px', fontFamily: 'Roboto Mono, monospace', textAlign: 'right', fontWeight: '600' }}>
                        ₹{item.subtotal.toFixed(2)}
                      </div>
                      <div>
                        <button type="button" onClick={() => {
                          const newItems = editForm.items.filter((_, i) => i !== idx);
                          setEditForm({ ...editForm, items: newItems });
                        }} className="btn-os ghost sm" style={{ color: 'var(--danger)', padding: '2px' }}>
                          <i className="bi bi-x" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {editForm.items.length === 0 && <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>Order will be empty.</div>}
                </div>
              </div>

              {/* Grand Total */}
              <div style={{ background: 'var(--brand-light)', padding: '12px', borderRadius: '10px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--brand)' }}>Grand Total (₹)</label>
                  {editForm.custom_total !== undefined && editForm.custom_total !== (editForm.items.reduce((acc, item) => acc + item.subtotal, 0) + (editForm.transportation_fee || 0)) && (
                    <span className="badge-modern brand" style={{ fontSize: '9px' }}>Adjusted</span>
                  )}
                </div>
                <input
                  type="number" min="0" step="any"
                  value={editForm.custom_total !== undefined ? editForm.custom_total : (editForm.items.reduce((acc, item) => acc + item.subtotal, 0) + (editForm.transportation_fee || 0))}
                  onChange={(e) => {
                    if (e.target.value === '') setEditForm({...editForm, custom_total: undefined});
                    else setEditForm({...editForm, custom_total: Math.max(0, parseFloat(e.target.value) || 0)});
                  }}
                  className="form-control-modern"
                  style={{ marginTop: '8px', fontSize: '16px', fontWeight: '700', fontFamily: 'Roboto Mono, monospace', color: 'var(--brand)', borderColor: 'var(--brand)' }}
                />
              </div>

              <div className="modal-actions-modern">
                <button type="button" onClick={() => setEditingSale(null)} className="btn-os outline full">Cancel</button>
                <button type="submit" disabled={isSavingEdit} className="btn-os primary full">
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