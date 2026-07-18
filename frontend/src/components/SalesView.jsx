import React, { useState } from 'react';

export default function SalesView({ token, products, isLoaded, refreshInventory }) {
  const [form, setForm] = useState({ 
    product_id: '', 
    quantity_to_sell: '',
    buyer_name: '',
    buyer_contact: '',
    quantity_unit: 'Kg',
    payment_method: 'Cash',
    amount_paid: '' // Track upfront cash/online collections
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  // ⚡ Calculate Estimated Bill Value on the fly
  const currentPrice = selectedProduct ? parseFloat(selectedProduct.price || 0) : 0;
  const inputQty = parseFloat(form.quantity_to_sell || 0);
  const estimatedTotal = form.quantity_unit === 'Kg' && selectedProduct
    ? (currentPrice / (parseFloat(selectedProduct.kg_per_unit) || 1)) * inputQty
    : currentPrice * inputQty;

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const totalBill = estimatedTotal;
    const upfrontPaid = form.amount_paid !== '' ? parseFloat(form.amount_paid) : totalBill;

    if (upfrontPaid < 0) {
      setFeedback({ type: 'error', message: 'Amount paid cannot be negative.' });
      setIsSubmitting(false);
      return;
    }

    if (upfrontPaid > totalBill) {
      setFeedback({ type: 'error', message: 'Amount paid cannot exceed total bill.' });
      setIsSubmitting(false);
      return;
    }

    // Determine final calculated ledger flags
    let absoluteMethod = form.payment_method;
    if (upfrontPaid === 0) {
      absoluteMethod = 'Credit';
    } else if (upfrontPaid < totalBill) {
      absoluteMethod = `Partial (${form.payment_method})`;
    }

    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          payment_method: absoluteMethod,
          amount_paid: upfrontPaid // Sent directly to backend
        }),
      });
      const data = await res.json();
      
      if (data.error) {
        setFeedback({ type: 'error', message: data.error });
      } else {
        setFeedback({ type: 'success', message: 'Transaction executed successfully.' });
        setForm({ 
          product_id: '', 
          quantity_to_sell: '',
          buyer_name: '',
          buyer_contact: '',
          quantity_unit: 'Kg',
          payment_method: 'Cash',
          amount_paid: ''
        });
        
        if (refreshInventory) await refreshInventory();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network connection failure.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockDisplay = (product) => {
    if (!product) return '';
    const quantity = parseFloat(product.quantity || 0);
    const kgPerUnit = parseFloat(product.kg_per_unit || 1);
    const totalKg = (quantity * kgPerUnit).toFixed(1);
    return `${quantity.toFixed(2)} Bags (${totalKg} Kg total)`;
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <header className="space-y-1 text-left max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary font-sans">
          Sales Terminal
        </h1>
        <p className="text-sm tracking-tight text-text-muted font-mono lowercase">
          transaction / point_of_sale
        </p>
      </header>

      <div className="max-w-xl mx-auto">
        <form
          onSubmit={handleSaleSubmit}
          className="bg-panel border border-border-subtle rounded-xl p-6 sm:p-8 space-y-6 shadow-xs relative"
        >
          <div className="space-y-5">
            {/* Target Product Catalog Picker */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Target Catalog Product</label>
              <select
                required
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono outline-none cursor-pointer"
              >
                <option value="" disabled>Select product item...</option>
                {!isLoaded ? (
                  <option disabled>Synchronizing registry data...</option>
                ) : (
                  products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ({getStockDisplay(p)} left)
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Customer Details Inline Form Layout */}
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Buyer Name</label>
                <input
                  type="text"
                  placeholder="Optional profile label"
                  value={form.buyer_name}
                  onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Contact Number</label>
                <input
                  type="text"
                  placeholder="Optional contact"
                  value={form.buyer_contact}
                  onChange={(e) => setForm({ ...form, buyer_contact: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
            </div>

            {/* Inventory Deduction Counter Inputs */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Quantity To Deduct</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Enter numeric volume"
                  required
                  min="0.001"
                  step="any"
                  value={form.quantity_to_sell}
                  onChange={(e) => setForm({ ...form, quantity_to_sell: e.target.value })}
                  className="flex-1 bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
                <select
                  value={form.quantity_unit}
                  onChange={(e) => setForm({ ...form, quantity_unit: e.target.value })}
                  className="w-28 bg-surface border border-border-subtle focus:border-zinc-500 rounded-lg transition-all px-3 py-3 text-sm text-text-primary font-mono outline-none cursor-pointer"
                >
                  <option value="Kg">Kg</option>
                  <option value="Bags">Bags</option>
                </select>
              </div>
            </div>

            {/* Dynamic Financial Math Boxes */}
            {estimatedTotal > 0 && (
              <div className="p-4 bg-surface rounded-lg border border-border-subtle/60 text-left space-y-3 font-sans">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Total Order Value:</span>
                  <span className="font-mono font-bold text-text-primary">₹{estimatedTotal.toFixed(2)}</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-text-muted block">Amount Paid Upfront (₹)</label>
                  <input 
                    type="number"
                    step="any"
                    min="0"
                    max={estimatedTotal}
                    placeholder={`Leave blank if paid in full (₹${estimatedTotal.toFixed(2)})`}
                    value={form.amount_paid}
                    onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                    className="w-full bg-panel border border-border-subtle rounded px-3 py-2 text-xs font-mono text-text-primary outline-none"
                  />
                </div>
              </div>
            )}

            {/* Payment Method Selector Grid */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Method Of Settlement</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface border border-border-subtle rounded-lg">
                {['Cash', 'Online'].map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setForm({ ...form, payment_method: method })}
                    className={`py-2 text-xs font-mono tracking-tight rounded-md transition-all cursor-pointer ${
                      form.payment_method === method 
                        ? 'bg-text-primary text-panel shadow-xs font-semibold' 
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {feedback && (
            <div className={`p-3 rounded-lg text-xs font-mono tracking-tight text-left border ${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !form.product_id || !form.quantity_to_sell}
            className="w-full bg-text-primary text-panel font-medium text-sm tracking-tight rounded-lg p-3.5 transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 mt-4 cursor-pointer"
          >
            {isSubmitting ? 'Processing Ledger Write...' : 'Execute Sale'}
          </button>
        </form>
      </div>
    </div>
  );
}