import { useState } from 'react';

// Product Unit Configuration Helper according to specific material matrix
const getProductUnitConfig = (product = {}) => {
  const name = (product.name || '').toLowerCase();
  const defaultUnitFromDb = product.default_unit;

  // 1. Ambuja Cement & Shri Cement (or general cement): Default unit Bags. Supports Bags and Kg (50 Kg = 1 Bag).
  if (name.includes('ambuja') || name.includes('shri') || (name.includes('cement') && !name.includes('white'))) {
    return {
      allowedUnits: ['Bags', 'Kg'],
      defaultUnit: defaultUnitFromDb || 'Bags',
      kgPerUnit: parseFloat(product.kg_per_unit) || 50,
      isCement: true
    };
  }

  // 2. Sand (Reti): Default unit Bags. Supports Bags and Kg (50 Kg = 1 Bag by default, configurable via kg_per_unit).
  //    Sold by the bag (e.g. 20 kg / 50 kg bags) or by Kg. Stock is stored in Bags.
  if (name.includes('reti') || name.includes('sand')) {
    return {
      allowedUnits: ['Bags', 'Kg'],
      defaultUnit: defaultUnitFromDb || 'Bags',
      kgPerUnit: parseFloat(product.kg_per_unit) || 50,
      isSand: true
    };
  }

  // 3. Khadi, Bhusa: Unit Baraas. Supports decimal inputs (0.5, 1.0, 1.5 Tempo loads).
  if (name.includes('khadi') || name.includes('bhusa')) {
    return {
      allowedUnits: ['Baraas'],
      defaultUnit: defaultUnitFromDb || 'Baraas',
      kgPerUnit: 1.00,
      isBaraas: true
    };
  }

  // 4. Eita (4" & 6") / AAC Blocks (6" & 8"): Fixed unit Piece.
  if (name.includes('eita') || name.includes('block') || name.includes('brick')) {
    return {
      allowedUnits: ['Piece'],
      defaultUnit: defaultUnitFromDb || 'Piece',
      kgPerUnit: 1.00
    };
  }

  // 5. Dr. Fixit (1L & 5L) / White Cement (1kg & 5kg): Fixed unit Pack or Piece.
  if (name.includes('fixit') || name.includes('white cement')) {
    return {
      allowedUnits: ['Pack', 'Piece'],
      defaultUnit: defaultUnitFromDb || 'Pack',
      kgPerUnit: 1.00
    };
  }

  // Fallback default configuration using product metadata or defaults
  const fallbackUnit = defaultUnitFromDb || 'Piece';
  return {
    allowedUnits: [fallbackUnit, 'Piece', 'Pack', 'Bags', 'Baraas', 'Kg'].filter((v, i, a) => a.indexOf(v) === i),
    defaultUnit: fallbackUnit,
    kgPerUnit: parseFloat(product.kg_per_unit) || 1.00
  };
};

export default function SalesTerminal({ token, products = [], isLoaded, onSaleComplete }) {
  // Global cart state
  const [cart, setCart] = useState([]);
  
  // Buyer details
  const [buyerName, setBuyerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transportationFee, setTransportationFee] = useState(0);
  const [advancePayment, setAdvancePayment] = useState('');

  // Current item inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('Piece');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Dynamic product selection handler
  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    const prod = (products || []).find(p => p && String(p.id) === String(productId));
    if (prod) {
      const config = getProductUnitConfig(prod);
      setQuantityUnit(config.defaultUnit);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedProductId || !quantity || parseFloat(quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Please select a product and valid quantity.' });
      return;
    }

    const product = (products || []).find(p => p && String(p.id) === String(selectedProductId));
    if (!product) return;

    const inputQty = parseFloat(quantity) || 0;
    const config = getProductUnitConfig(product);
    
    let unitsToDeduct = inputQty;
    let pricePerUnit = parseFloat(product.price || 0) || 0;
    const kgPerUnit = config.kgPerUnit || 50;

    // Both cement and sand use Bags as the base stock unit, with optional Kg input.
    // When selling in Kg: deduct fractional bags and recalculate unit price to ₹/Kg.
    if (config.isCement || config.isSand) {
      if (quantityUnit === 'Kg') {
        unitsToDeduct = inputQty / kgPerUnit;   // convert Kg → Bags for stock deduction
        pricePerUnit = pricePerUnit / kgPerUnit; // convert ₹/Bag → ₹/Kg
      } else {
        unitsToDeduct = inputQty; // already in Bags
      }
    } else {
      unitsToDeduct = inputQty;
    }

    const currentStock = parseFloat(product.quantity ?? product.stock ?? 0) || 0;
    const existingInCart = cart.filter(item => item && String(item.product_id) === String(selectedProductId));
    const alreadyDeducted = existingInCart.reduce((sum, item) => sum + (item.unitsToDeduct || 0), 0);

    if (unitsToDeduct + alreadyDeducted > currentStock) {
      setFeedback({ 
        type: 'error', 
        message: `Insufficient stock! Only ${currentStock.toFixed(2)} ${product.default_unit || 'units'} available.` 
      });
      return;
    }

    const subtotal = pricePerUnit * inputQty;

    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => 
        item && String(item.product_id) === String(selectedProductId) && item.unit === quantityUnit
      );

      if (existingIdx >= 0) {
        const newCart = [...prevCart];
        const item = { ...newCart[existingIdx] };
        item.displayQuantity += inputQty;
        item.unitsToDeduct += unitsToDeduct;
        item.subtotal += subtotal;
        newCart[existingIdx] = item;
        return newCart;
      } else {
        return [...prevCart, {
          product_id: product.id,
          name: product.name || 'Unnamed Product',
          unit_price: pricePerUnit,
          displayQuantity: inputQty,
          unitsToDeduct: unitsToDeduct,
          unit: quantityUnit,
          subtotal: subtotal
        }];
      }
    });

    setSelectedProductId('');
    setQuantity('');
  };

  const handlePriceChange = (index, newPriceStr) => {
    const newPrice = parseFloat(newPriceStr);
    setCart(prevCart => {
      const newCart = [...prevCart];
      const item = { ...newCart[index] };
      item.unit_price = isNaN(newPrice) ? '' : newPrice;
      const validPrice = isNaN(newPrice) ? 0 : newPrice;
      item.subtotal = validPrice * (item.displayQuantity || 0);
      newCart[index] = item;
      return newCart;
    });
  };

  const handleRemoveFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const baseTotal = cart.reduce((sum, item) => sum + (typeof item?.subtotal === 'number' ? item.subtotal : 0), 0);
  const transportFee = transportationFee;
  const grandTotal = baseTotal + transportFee;

  // --- ADVANCE PAYMENT: Clamped change handler ---
  const handleAdvanceChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    if (val > grandTotal) {
      setAdvancePayment(grandTotal);
    } else if (val < 0) {
      setAdvancePayment(0);
    } else {
      setAdvancePayment(val === 0 && e.target.value === '' ? '' : val);
    }
  };
  const advanceOverLimit = parseFloat(advancePayment) > grandTotal;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    setFeedback(null);

    const isCredit = paymentMethod === 'Credit / Unpaid';
    const paidAmt = isCredit ? (parseFloat(advancePayment) || 0) : grandTotal;
    const dueAmt = Math.max(0, grandTotal - paidAmt);
    let payStatus = 'Paid';
    if (isCredit) {
      if (dueAmt === 0) {
        payStatus = 'Paid';
      } else if (paidAmt > 0 && dueAmt > 0) {
        payStatus = 'Partial';
      } else if (paidAmt === 0) {
        payStatus = 'Unpaid';
      }
    }

    const payload = {
      buyer_name: buyerName || 'Walk-in Customer',
      contact_number: contactNumber || 'N/A',
      payment_method: isCredit ? 'Credit / Unpaid' : paymentMethod,
      payment_status: payStatus,
      total_amount: grandTotal,
      transportation_fee: transportFee,
      paid_amount: paidAmt,
      due_amount: dueAmt,
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.unitsToDeduct || 0, 
        unit_price: typeof item.unit_price === 'number' ? item.unit_price : 0,
        subtotal: typeof item.subtotal === 'number' ? item.subtotal : 0
      }))
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.error)) {
        setFeedback({ type: 'error', message: (data && data.error) || `Server Error (${res.status})` });
      } else if (data) {
        setFeedback({ type: 'success', message: `Order #${data.order_id} executed successfully!` });
        
        // Reset state
        setCart([]);
        setBuyerName('');
        setContactNumber('');
        setPaymentMethod('Cash');
        setTransportationFee(0);
        setAdvancePayment('');
        setSelectedProductId('');
        setQuantity('');
        
        if (onSaleComplete) await onSaleComplete();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Network connection failure.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = (products || []).find(p => p && String(p.id) === String(selectedProductId));
  const currentUnitConfig = getProductUnitConfig(selectedProduct || {});

  const getStockDisplay = (product) => {
    if (!product) return '0 units available';
    const qty = parseFloat(product.quantity ?? product.stock ?? 0) || 0;
    const unit = product.default_unit || 'units';
    return `${qty.toFixed(2)} ${unit} in stock`;
  };

  const paymentMethods = [
    { id: 'Cash', label: 'Cash', icon: 'bi-cash-coin' },
    { id: 'Online', label: 'Online', icon: 'bi-phone' },
    { id: 'Credit / Unpaid', label: 'Credit', icon: 'bi-credit-card-2-front', danger: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease both' }}>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Terminal</h1>
          <p className="page-subtitle">Point of sale — multi-item cart checkout</p>
        </div>
        <div className="page-actions">
          {cart.length > 0 && (
            <span className="badge-modern brand" style={{ fontSize: '13px', padding: '6px 14px' }}>
              <i className="bi bi-cart3 me-1" /> {cart.length} item{cart.length !== 1 ? 's' : ''} in cart
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">

        {/* ── LEFT: CUSTOMER + ADD ITEM ── */}
        <div className="col-span-1 lg:col-span-6 flex flex-col gap-4">

          {/* Customer Details */}
          <div className="card-modern">
            <div className="card-header-modern">
              <div>
                <h2 className="card-header-title">
                  <i className="bi bi-person-lines-fill me-2" style={{ color: 'var(--brand)' }} />
                  1. Buyer Details
                </h2>
              </div>
            </div>
            <div className="card-body-modern">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label-modern">Buyer Name</label>
                  <input
                    type="text"
                    placeholder="Optional name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="form-control-modern"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label-modern">Contact Number</label>
                  <input
                    type="text"
                    placeholder="Optional contact"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="form-control-modern"
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label-modern">Transport / Delivery Charge (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    fontSize: '14px', pointerEvents: 'none', fontWeight: '600'
                  }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={transportationFee}
                    onChange={(e) => setTransportationFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="form-control-modern"
                    style={{ paddingLeft: '28px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add Item */}
          <div className="card-modern">
            <div className="card-header-modern">
              <div>
                <h2 className="card-header-title">
                  <i className="bi bi-bag-plus me-2" style={{ color: 'var(--brand)' }} />
                  2. Add Item to Cart
                </h2>
              </div>
            </div>
            <div className="card-body-modern">
              <form onSubmit={handleAddToCart} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                <div className="form-group">
                  <label className="form-label-modern">Select Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="form-control-modern form-select-modern"
                  >
                    <option value="" disabled>Choose a product...</option>
                    {!isLoaded ? (
                      <option disabled>Loading inventory...</option>
                    ) : (
                      (products || []).map((p) => {
                        if (!p || !p.id) return null;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name || 'Unnamed Item'} — ({getStockDisplay(p)})
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label-modern">Quantity</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      placeholder="e.g. 0.5, 1, 10"
                      min="0"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="form-control-modern"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value)}
                      className="form-control-modern form-select-modern"
                      style={{ width: '100px' }}
                    >
                      {currentUnitConfig.allowedUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {feedback && feedback.type === 'error' && !isSubmitting && (
                  <div className="alert-modern danger">
                    <i className="bi bi-exclamation-circle-fill" />
                    <span>{feedback.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-os outline full"
                  style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
                >
                  <i className="bi bi-plus-lg" /> Add to Cart
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ── RIGHT: CART + CHECKOUT ── */}
        <div className="col-span-1 lg:col-span-6 card-modern flex flex-col">
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-cart3 me-2" style={{ color: 'var(--brand)' }} />
                3. Cart Summary
              </h2>
              <p className="card-header-subtitle">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Cart Items */}
          <div style={{ flex: 1, minHeight: '200px', overflowY: 'auto' }} className="custom-scrollbar">
            {cart.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px' }}>
                <i className="bi bi-cart-x empty-state-icon" />
                <p className="empty-state-title">Cart is empty</p>
                <p className="empty-state-text">Add items from the product list</p>
              </div>
            ) : (
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price/Unit</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge-modern neutral" style={{ fontSize: '11px' }}>
                          {item.displayQuantity} {item.unit}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            style={{
                              width: '72px', background: 'var(--bg-surface)',
                              border: '1.5px solid var(--border)', borderRadius: '6px',
                              padding: '4px 6px', fontSize: '12px', textAlign: 'right',
                              color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace',
                              outline: 'none', fontWeight: '600',
                            }}
                            onFocus={e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.background = '#fff'; }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg-surface)'; }}
                          />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'Roboto Mono, monospace', fontWeight: '700', color: 'var(--text-primary)', fontSize: '12.5px' }}>
                        ₹{(typeof item.subtotal === 'number' ? item.subtotal : 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleRemoveFromCart(idx)}
                          className="btn-os ghost sm"
                          style={{ color: 'var(--danger)', padding: '4px 6px', opacity: 0.7 }}
                          title="Remove"
                        >
                          <i className="bi bi-x-lg" style={{ fontSize: '11px' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Order Summary + Checkout */}
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: '600' }}>₹{baseTotal.toFixed(2)}</span>
              </div>
              {transportFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Transport Charge</span>
                  <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: '600' }}>+₹{transportFee.toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: '1.5px solid var(--border)', paddingTop: '10px', marginTop: '2px',
              }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Grand Total</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--success)', fontFamily: 'Roboto Mono, monospace', letterSpacing: '-0.02em' }}>
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Payment Method
              </div>
              <div className="grid grid-cols-3 gap-2 w-full text-xs">
                {paymentMethods.map(method => {
                  const isSelected = paymentMethod === method.id;
                  const isDanger = method.danger;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(method.id);
                        if (method.id !== 'Credit / Unpaid') setAdvancePayment('');
                      }}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '8px',
                        border: `1.5px solid ${isSelected ? (isDanger ? 'var(--danger)' : 'var(--brand)') : 'var(--border)'}`,
                        background: isSelected
                          ? isDanger ? 'var(--danger)' : 'var(--brand)'
                          : isDanger ? 'var(--danger-light)' : 'transparent',
                        color: isSelected ? '#fff' : isDanger ? 'var(--danger)' : 'var(--text-secondary)',
                        fontSize: '11.5px', fontWeight: '600',
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      }}
                    >
                      <i className={`bi ${method.icon}`} style={{ fontSize: '14px' }} />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {/* Credit advance input */}
              {paymentMethod === 'Credit / Unpaid' && (
                <div style={{ marginTop: '12px', animation: 'fadeIn 0.25s ease both' }}>
                  <div className="form-group">
                    <label className="form-label-modern">Advance Paid Amount (₹)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', pointerEvents: 'none' }}>₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={grandTotal}
                        placeholder="0.00"
                        value={advancePayment}
                        onChange={handleAdvanceChange}
                        className={`form-control-modern${advanceOverLimit ? ' error' : ''}`}
                        style={{ paddingLeft: '28px' }}
                      />
                    </div>
                    {advanceOverLimit && (
                      <p style={{ fontSize: '11.5px', color: 'var(--danger)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="bi bi-exclamation-triangle-fill" />
                        Cannot exceed ₹{grandTotal.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Payment breakdown */}
                  {(() => {
                    const adv = Math.min(parseFloat(advancePayment) || 0, grandTotal);
                    const due = Math.max(0, grandTotal - adv);
                    const status = due === 0 ? 'Paid' : adv > 0 ? 'Partial' : 'Unpaid';
                    const statusColor = due === 0 ? 'success' : adv > 0 ? 'warning' : 'danger';
                    return (
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Paid Amount:</span>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: '700', color: 'var(--success)' }}>₹{adv.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Remaining Due:</span>
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: '700', color: due > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{due.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '7px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                          <span className={`badge-modern ${statusColor}`}>{status}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`alert-modern ${feedback.type === 'success' ? 'success' : 'danger'}`}>
                <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`} />
                <span>{feedback.message}</span>
              </div>
            )}

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className="btn-os success w-full py-3 text-sm font-semibold"
            >
              {isSubmitting ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Processing...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle" /> Confirm & Checkout
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .sales-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}