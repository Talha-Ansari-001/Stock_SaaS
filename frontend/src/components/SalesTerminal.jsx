import React, { useState } from 'react';

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

  // 2. Sand (Reti), Khadi, Bhusa: Unit Baraas. Supports decimal inputs (0.5, 1.0, 1.5 Tempo loads). kg_per_unit defaults to 1.00.
  if (name.includes('reti') || name.includes('sand') || name.includes('khadi') || name.includes('bhusa')) {
    return {
      allowedUnits: ['Baraas'],
      defaultUnit: defaultUnitFromDb || 'Baraas',
      kgPerUnit: 1.00,
      isBaraas: true
    };
  }

  // 3. Eita (4" & 6") / AAC Blocks (6" & 8"): Fixed unit Piece.
  if (name.includes('eita') || name.includes('block') || name.includes('brick')) {
    return {
      allowedUnits: ['Piece'],
      defaultUnit: defaultUnitFromDb || 'Piece',
      kgPerUnit: 1.00
    };
  }

  // 4. Dr. Fixit (1L & 5L) / White Cement (1kg & 5kg): Fixed unit Pack or Piece.
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

    if (config.isCement) {
      if (quantityUnit === 'Kg') {
        unitsToDeduct = inputQty / kgPerUnit;
        pricePerUnit = pricePerUnit / kgPerUnit; // price per kg
      } else {
        unitsToDeduct = inputQty; // Bags
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

  const grandTotal = cart.reduce((sum, item) => sum + (typeof item?.subtotal === 'number' ? item.subtotal : 0), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    setFeedback(null);

    const isCreditUnpaid = paymentMethod === 'Credit / Unpaid';

    const payload = {
      buyer_name: buyerName || 'Walk-in Customer',
      contact_number: contactNumber || 'N/A',
      payment_method: isCreditUnpaid ? 'Credit / Unpaid' : paymentMethod,
      total_amount: grandTotal,
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
      } catch (e) {
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

  return (
    <div className="space-y-10 animate-fade-in">
      <header className="space-y-1 text-left max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary font-sans">
          Point of Sale - Multi-Item Cart
        </h1>
        <p className="text-sm tracking-tight text-text-muted font-mono lowercase">
          transaction / checkout
        </p>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Controls */}
        <div className="space-y-6">
          {/* Customer Details Form */}
          <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase mb-4 border-b border-border-subtle pb-2">1. Buyer Details</h2>
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Buyer Name</label>
                <input
                  type="text"
                  placeholder="Optional profile label"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Contact Number</label>
                <input
                  type="text"
                  placeholder="Optional contact"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
            </div>
            <div className="space-y-1.5 text-left pt-2">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Payment Method</label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-surface border border-border-subtle rounded-lg">
                {['Cash', 'Online', 'Credit / Unpaid'].map(method => {
                  const isSelected = paymentMethod === method;
                  const isCredit = method === 'Credit / Unpaid';
                  
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-1 text-xs font-mono tracking-tight rounded-md transition-all cursor-pointer ${
                        isSelected 
                          ? isCredit
                            ? 'bg-red-500 text-white shadow-xs font-bold'
                            : 'bg-text-primary text-panel shadow-xs font-semibold' 
                          : isCredit
                            ? 'bg-red-500/10 text-red-500 font-medium hover:bg-red-500/20'
                            : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add Item Form */}
          <form onSubmit={handleAddToCart} className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4 shadow-xs relative">
            <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase mb-4 border-b border-border-subtle pb-2">2. Add Item</h2>
            <div className="space-y-5">
              <div className="space-y-1.5 text-left">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono outline-none cursor-pointer"
                >
                  <option value="" disabled>Select product item...</option>
                  {!isLoaded ? (
                    <option disabled>Loading data...</option>
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

              <div className="space-y-1.5 text-left">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Quantity</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="e.g. 0.5, 1, 10"
                    min="0.001"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                  />
                  <select
                    value={quantityUnit}
                    onChange={(e) => setQuantityUnit(e.target.value)}
                    className="w-32 bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-3 py-3 text-sm text-text-primary font-mono outline-none cursor-pointer"
                  >
                    {currentUnitConfig.allowedUnits.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-zinc-200 text-zinc-900 hover:bg-zinc-300 font-medium text-sm tracking-tight rounded-lg p-3 transition-all duration-200 cursor-pointer mt-2"
            >
              + Add to Cart
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Cart Summary */}
        <div className="bg-panel border border-border-subtle rounded-xl p-6 shadow-xs flex flex-col h-full">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary uppercase mb-4 border-b border-border-subtle pb-2">
            3. Cart Summary ({cart.length} items)
          </h2>
          
          <div className="flex-1 overflow-y-auto mb-4 min-h-[200px]">
            {cart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-text-muted text-sm font-mono border-2 border-dashed border-border-subtle rounded-lg">
                Cart is empty
              </div>
            ) : (
              <table className="w-full text-left text-sm font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Price</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                    <th className="pb-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {cart.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="py-3 text-text-primary">{item.name}</td>
                      <td className="py-3 text-right">
                        <span className="bg-surface px-2 py-1 rounded text-xs border border-border-subtle">
                          {item.displayQuantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <span className="text-text-muted text-xs font-mono">₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            className="w-20 bg-surface border border-border-subtle focus:border-zinc-500 rounded px-2 py-1 text-xs text-right text-text-primary font-mono outline-none"
                          />
                        </div>
                      </td>
                      <td className="py-3 text-right font-medium">₹{(typeof item.subtotal === 'number' ? item.subtotal : 0).toFixed(2)}</td>
                      <td className="py-3 text-right">
                        <button 
                          onClick={() => handleRemoveFromCart(idx)}
                          className="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-4 mt-auto">
            <div className="flex justify-between items-center text-lg">
              <span className="font-semibold text-text-primary font-sans">Grand Total:</span>
              <span className="font-mono font-bold text-emerald-500">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {feedback && (
              <div className={`p-3 rounded-lg text-xs font-mono tracking-tight text-left border ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                {feedback.message}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className="w-full bg-text-primary text-panel font-bold text-sm tracking-tight rounded-lg p-4 transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg"
            >
              {isSubmitting ? 'Processing Checkout...' : 'Confirm Order & Checkout'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}