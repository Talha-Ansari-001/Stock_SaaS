import React, { useState } from 'react';

export default function InventoryView({ token, products, isLoaded, refreshInventory }) {
  const [form, setForm] = useState({ 
    name: '', 
    quantity: '', 
    price: '', 
    buying_price: '', 
    kg_per_unit: '20', // ⚡ Defaulting to standard 20 Kg bags
    supplier_name: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  
  // Modal tracking state structures
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    setFormSuccess('');
    try {
      const res = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name,
          quantity: parseInt(form.quantity, 10),
          price: parseFloat(form.price),
          buying_price: parseFloat(form.buying_price),
          kg_per_unit: parseFloat(form.kg_per_unit) || 1.00, // ⚡ Pass conversions down cleanly
          supplier_name: form.supplier_name || null
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to add product. Please try again.');
        return;
      }
      setForm({ name: '', quantity: '', price: '', buying_price: '', kg_per_unit: '20', supplier_name: '' });
      setFormSuccess('Product provisioned successfully!');
      setTimeout(() => setFormSuccess(''), 3000);
      // Silent background cache sync update
      if (refreshInventory) await refreshInventory();
    } catch (err) {
      console.error('Provision commit failure:', err);
      setFormError('Network error. Is the backend server running?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExecute = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`http://localhost:5000/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setDeleteTarget(null);
        if (refreshInventory) await refreshInventory();
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete product.');
      }
    } catch (err) {
      console.error('Purge transaction failure:', err);
      setDeleteError('Network error. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in">
      {/* Header and overview stat summary */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle/40 pb-6">
        <div className="space-y-1 text-left">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-text-primary font-sans">
            Inventory Registry
          </h1>
          <p className="text-xs md:text-sm tracking-tight text-text-muted font-mono lowercase">
            catalogue_management / batch_metrics
          </p>
        </div>
      </header>

      {/* Grid Layout splits forms and listings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">
        
        {/* ADD INVENTORY FORM PANELS */}
        <form
          onSubmit={handleAdd}
          className="bg-panel border border-border-subtle rounded-xl p-5 md:p-6 space-y-5 shadow-xs text-left"
        >
          <h2 className="text-sm font-medium tracking-tight text-text-primary font-sans mb-4">
            Provision New Batch
          </h2>

          <div className="space-y-4">
            {/* Product Identifier Name */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Product Name / Label</label>
              <input
                type="text"
                placeholder="e.g. Sand - 20kg Bag"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Supplier Origin */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Supplier Entity Name</label>
              <input
                type="text"
                placeholder="e.g. Trader A"
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Units Quantity & Conversion Ratio */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Bags Quantity</label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  required
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Kg Per Unit</label>
                <input
                  type="number"
                  placeholder="e.g. 20"
                  required
                  min="1"
                  step="0.01"
                  value={form.kg_per_unit}
                  onChange={(e) => setForm({ ...form, kg_per_unit: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
            </div>

            {/* Financial valuations (Selling Price & Cost Buying Rate) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Cost (Buy Price)</label>
                <input
                  type="number"
                  placeholder="Cost per unit"
                  required
                  min="0"
                  step="0.01"
                  value={form.buying_price}
                  onChange={(e) => setForm({ ...form, buying_price: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Selling Price</label>
                <input
                  type="number"
                  placeholder="Retail price"
                  required
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
            </div>
          </div>

          {/* Error / Success feedback */}
          {formError && (
            <div className="text-xs font-mono text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              ✕ {formError}
            </div>
          )}
          {formSuccess && (
            <div className="text-xs font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              ✓ {formSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-text-primary text-panel font-medium text-sm tracking-tight rounded-lg p-3 transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 mt-4 cursor-pointer"
          >
            {isSubmitting ? 'Registering...' : 'Provision Item'}
          </button>
        </form>

        {/* INVENTORY REGISTRY DISPLAY TABULAR SYSTEM */}
        <div className="lg:col-span-2 bg-panel border border-border-subtle rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle/60 bg-surface">
                  <th className="px-4 py-3.5 text-xs font-mono font-medium text-text-muted uppercase tracking-wider">Asset Item</th>
                  <th className="px-4 py-3.5 text-xs font-mono font-medium text-text-muted uppercase tracking-wider">Unit Metrics</th>
                  <th className="px-4 py-3.5 text-xs font-mono font-medium text-text-muted uppercase tracking-wider">Buy (Cost)</th>
                  <th className="px-4 py-3.5 text-xs font-mono font-medium text-text-muted uppercase tracking-wider">Sell Price</th>
                  <th className="px-4 py-3.5 text-xs font-mono font-medium text-text-muted uppercase tracking-wider">Total Weight</th>
                  <th className="px-4 py-3.5 text-xs font-mono font-medium text-text-muted uppercase tracking-wider text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/30 font-mono text-sm">
                {!isLoaded ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-text-muted font-sans text-xs">
                      Synchronizing local cache matrix...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-text-muted font-sans text-xs">
                      No active assets deployed in your organization context.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const quantity = p.quantity !== undefined ? p.quantity : p.stock || 0;
                    const kgPerUnit = parseFloat(p.kg_per_unit) || 1.00;
                    const totalWeight = (quantity * kgPerUnit).toFixed(2);
                    
                    return (
                      <tr key={p.id} className="hover:bg-surface/30 transition-colors duration-150">
                        <td className="px-4 py-4">
                          <div className="font-sans font-semibold text-text-primary text-sm">{p.name}</div>
                          {p.supplier_name && (
                            <div className="text-[10px] text-text-muted mt-0.5">supplier: {p.supplier_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-text-primary">
                          <span className="font-semibold">{Number(quantity).toFixed(2)}</span>
                          <span className="text-[10px] text-text-muted ml-1">Bags ({kgPerUnit} Kg/ea)</span>
                        </td>
                        <td className="px-4 py-4 text-text-secondary">₹{parseFloat(p.buying_price || 0).toLocaleString()}</td>
                        <td className="px-4 py-4 text-text-primary font-semibold">₹{parseFloat(p.price || 0).toLocaleString()}</td>
                        <td className="px-4 py-4 text-emerald-500 font-semibold">{totalWeight} Kg</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="inline-flex items-center justify-center p-1.5 text-text-muted hover:text-red-500 rounded-md hover:bg-red-500/10 transition-all cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CONFIRMATION MODAL OVERLAY */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-panel border border-red-500/20 rounded-xl p-6 max-w-sm w-full space-y-6 shadow-xl text-left">
            <div className="space-y-2">
              <h3 className="text-base font-medium tracking-tight text-text-primary font-sans">Confirm Item Purge</h3>
              <p className="text-sm text-text-secondary font-sans">
                Are you sure you want to permanently delete <span className="text-text-primary font-mono bg-surface px-1.5 py-0.5 rounded border border-border-subtle">{deleteTarget.name}</span>? This action cannot be reversed.
              </p>
            </div>
            {deleteError && (
              <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                ✕ {deleteError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                disabled={isDeleting}
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                className="flex-1 border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover text-sm font-medium p-2.5 rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteExecute}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-medium p-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Purging...' : 'Delete Row'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}