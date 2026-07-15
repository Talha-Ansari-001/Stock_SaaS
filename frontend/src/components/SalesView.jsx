import React, { useState } from 'react';

export default function SalesView({ token, products, isLoaded, refreshInventory }) {
  const [form, setForm] = useState({ 
    product_id: '', 
    quantity_to_sell: '',
    buyer_name: '',
    buyer_contact: '',
    quantity_unit: 'Kg',
    payment_method: 'Cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
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
          payment_method: 'Cash'
        });
        
        // ⚡ Instantly triggers App.jsx to fetch fresh stock numbers from database
        if (refreshInventory) {
          await refreshInventory();
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network connection failure.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  // ⚡ Helper metrics calculator for real-time stock feedback
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
          <div className="space-y-1 text-left mb-4">
            <h2 className="text-base font-medium tracking-tight text-text-primary font-sans">
              New Transaction Entry
            </h2>
          </div>

          <div className="space-y-5">
            {/* Target Product Catalog Picker */}
            <div className="space-y-1.5">
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

            {/* Dynamic Metric Information Cards */}
            {selectedProduct && (
              <div className="flex flex-col gap-2 p-4 bg-surface rounded-lg border border-border-subtle/50 text-left text-xs font-sans">
                <div className="flex justify-between">
                  <span className="text-text-muted">Packaging Spec:</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {parseFloat(selectedProduct.kg_per_unit || 1)} Kg per Bag
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-subtle/30 pt-2">
                  <span className="text-text-muted">Available Stock Balance:</span>
                  <span className="font-mono font-bold text-emerald-500">
                    {getStockDisplay(selectedProduct)}
                  </span>
                </div>
              </div>
            )}

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

            {/* Inventory Reduction Counter Inputs */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Quantity To Deduct</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Enter numeric volume"
                  required
                  min="0.001"
                  step="any" // ⚡ Supports fraction points (e.g. 2.5 kg, 0.5 kg) without forcing integers
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
            <div className={`p-3 rounded-lg text-xs font-mono tracking-tight text-left border ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
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