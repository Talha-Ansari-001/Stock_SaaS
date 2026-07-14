import React, { useState, useEffect } from 'react';

export default function InventoryView({ token }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', quantity: '', price: '', buying_price: '', supplier_name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Modal tracking state structures
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const loadInventory = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/products', { headers });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Inventory sync failure:', err);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => { loadInventory(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name,
          quantity: parseInt(form.quantity, 10),
          price: parseFloat(form.price),
          buying_price: parseFloat(form.buying_price),
          supplier_name: form.supplier_name || null
        }),
      });
      setForm({ name: '', quantity: '', price: '', buying_price: '', supplier_name: '' });
      await loadInventory();
    } catch (err) {
      console.error('Provision commit failure:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExecute = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        await loadInventory();
      }
    } catch (err) {
      console.error('Purge transaction broken:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className={`space-y-10 transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <header className="space-y-1 text-left">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary font-sans">
          Inventory Assets
        </h1>
        <p className="text-sm tracking-tight text-text-muted font-mono lowercase">
          terminal / active_manifest
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT PANE - Control Form */}
        <form 
          onSubmit={handleAdd} 
          className="bg-panel border border-border-subtle rounded-xl p-8 space-y-6 shadow-md transition-colors duration-300"
        >
          <div className="space-y-1 text-left">
            <h2 className="text-base font-medium tracking-tight text-text-primary font-sans">Provision Stock</h2>
          </div>

          <div className="space-y-4">
            {/* Product Title */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Product Identifier</label>
              <input
                type="text"
                placeholder="Name (e.g. Cotton)"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Supplier Meta */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Supplier Name</label>
              <input
                type="text"
                placeholder="Supplier (e.g. ABC Textiles)"
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Total Units */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-text-muted font-sans block">Quantity</label>
              <input
                type="number"
                placeholder="Units"
                required
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Pricing Dual Grid Split Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Buying Price</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Cost USD"
                  required
                  value={form.buying_price}
                  onChange={(e) => setForm({ ...form, buying_price: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-text-muted font-sans block">Base Price (Sell)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Sell USD"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-surface border border-border-subtle focus:border-zinc-500 dark:focus:border-zinc-400 rounded-lg transition-all px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-text-primary text-base font-medium text-sm tracking-tight rounded-lg p-3 transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Committing...' : 'Add to Inventory'}
          </button>
        </form>

        {/* RIGHT PANE - Asset Terminal Grid */}
        <div className="lg:col-span-2 bg-panel border border-border-subtle rounded-xl p-8 flex flex-col h-[600px] shadow-md transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-medium tracking-tight text-text-primary font-sans">Warehouse Standings</h2>
            <span className="text-xs tracking-tight text-text-muted font-mono">rows: {products.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {products.length === 0 ? (
              <div className="text-center py-10 text-text-muted text-sm font-sans tracking-tight">No products found</div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center justify-between p-4 bg-surface border border-transparent hover:border-border-subtle rounded-lg transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-mono text-text-muted">{(p.id || 0).toString().padStart(4, '0')}</span>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="text-sm font-medium text-text-primary tracking-tight truncate">{p.name}</span>
                      {p.supplier_name && <span className="text-[10px] text-text-muted font-mono truncate">via {p.supplier_name}</span>}
                    </div>
                  </div>
                  
                  {/* Performance Metric Row Columns */}
                  <div className="flex items-center gap-6 flex-shrink-0 transition-transform duration-300 group-hover:-translate-x-8">
                    <div className="text-right">
                      <span className="text-sm font-mono text-[#10b981]">{(p.quantity ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-text-muted font-sans tracking-tight block">stock</span>
                    </div>
                    
                    <div className="text-right w-14">
                      <span className="text-sm font-mono text-text-secondary">${p.buying_price ? parseFloat(p.buying_price).toFixed(2) : '0.00'}</span>
                      <span className="text-[10px] text-text-muted font-sans tracking-tight block">cost</span>
                    </div>

                    <div className="text-right w-14">
                      <span className="text-sm font-mono text-text-primary">${p.price ? parseFloat(p.price).toFixed(2) : '0.00'}</span>
                      <span className="text-[10px] text-text-muted font-sans tracking-tight block">price</span>
                    </div>
                  </div>

                  {/* Absolute Inline Deletion Trigger Control */}
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-text-muted hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                    title="Purge row entry"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── LUXURY CONFIRMATION DIALOG MODAL OVERLAY ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-panel border border-red-500/20 rounded-xl p-6 max-w-sm w-full space-y-6 shadow-xl text-left">
            <div className="space-y-2">
              <h3 className="text-base font-medium tracking-tight text-text-primary font-sans">Confirm Item Purge</h3>
              <p className="text-sm text-text-secondary font-sans">
                Are you sure you want to permanently delete <span className="text-text-primary font-mono bg-surface px-1.5 py-0.5 rounded border border-border-subtle">{deleteTarget.name}</span>? This action historical balances cannot be reversed.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
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