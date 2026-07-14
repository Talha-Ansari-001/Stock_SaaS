import React, { useState, useEffect } from 'react';

export default function TraderDashboard({ token }) {
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form States
  const [newProduct, setNewProduct] = useState({ name: '', quantity: '', price: '' });
  const [newSale, setNewSale] = useState({ product_id: '', quantity_to_sell: '' });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const prodRes = await fetch('http://localhost:5000/api/products', { headers });
      if (!prodRes.ok) throw new Error(`Products server status error: ${prodRes.status}`);
      const prodData = await prodRes.json();
      // Safeguard: Ensure data is strictly parsed as an array
      setProducts(Array.isArray(prodData) ? prodData : []);

      const salesRes = await fetch('http://localhost:5000/api/sales/history', { headers });
      if (!salesRes.ok) throw new Error(`Sales server status error: ${salesRes.status}`);
      const salesData = await salesRes.json();
      // Safeguard: Ensure data is strictly parsed as an array
      setSalesHistory(Array.isArray(salesData) ? salesData : []);
    } catch (err) {
      console.error("Error syncing dashboard parameters:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    } else {
      setError("Missing active authorization context.");
      setLoading(false);
    }
  }, [token]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify(newProduct)
      });
      setNewProduct({ name: '', quantity: '', price: '' });
      loadData();
    } catch (err) {
      alert("Failed to write inventory asset.");
    }
  };

  const handleLogSale = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers,
        body: JSON.stringify(newSale)
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      setNewSale({ product_id: '', quantity_to_sell: '' });
      loadData();
    } catch (err) {
      alert("Failed to execute deductive sale transaction.");
    }
  };

  // Safe calculation matrix with fallback protection numbers
  const totalRevenue = Array.isArray(salesHistory)
    ? salesHistory.reduce((acc, sale) => acc + parseFloat(sale.total_revenue || 0), 0)
    : 0;

  // 1. Loading State Screen Interface
  if (loading) {
    return (
      <div className="min-h-screen bg-base text-text-muted flex items-center justify-center font-mono text-xs uppercase tracking-widest">
        Syncing Trader Ledger Workspace...
      </div>
    );
  }

  // 2. Error Boundary Screen Interface
  if (error) {
    return (
      <div className="min-h-screen bg-base text-red-400 flex flex-col items-center justify-center p-4 font-sans">
        <div className="border border-red-900/40 bg-[#141014] p-6 max-w-md w-full text-center">
          <h2 className="text-sm font-bold tracking-wider uppercase mb-2">Workspace Dynamic Error</h2>
          <p className="text-xs text-text-muted mb-4 bg-[#1c161c] p-3 font-mono break-words">{error}</p>
          <button onClick={loadData} className="border border-gray-700 text-gray-200 px-4 py-2 text-xs uppercase hover:bg-white hover:text-black transition transition-all">
            Retry Connection Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base text-text-primary p-8 font-sans">
      {/* Top Banner Metric Summary */}
      <div className="mb-8 p-6 bg-panel border border-border-subtle rounded-none shadow-2xl flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-text-primary uppercase">Trader Ledger Workspace</h1>
          <p className="text-xs text-text-muted mt-1">Real-time inventory deduction logs</p>
        </div>
        <div className="text-right">
          <span className="text-xs tracking-widest text-text-muted uppercase block">Accumulated Revenue</span>
          <span className="text-3xl font-mono font-bold text-emerald-400">
            ${typeof totalRevenue === 'number' ? totalRevenue.toFixed(2) : "0.00"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: CONTROL STATIONS */}
        <div className="space-y-8">
          {/* Action 1: Add New Catalog Items */}
          <div className="bg-panel border border-border-subtle p-6 rounded-none">
            <h2 className="text-sm font-semibold tracking-wider uppercase mb-4 text-text-secondary">1. Provision New Product Stock</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <input 
                type="text" placeholder="Product Name" required
                className="w-full bg-surface border border-border-subtle p-3 text-sm focus:outline-none focus:border-gray-400 rounded-none transition"
                value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" placeholder="Initial Quantity" required min="1"
                  className="w-full bg-surface border border-border-subtle p-3 text-sm focus:outline-none focus:border-gray-400 rounded-none transition"
                  value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: e.target.value})}
                />
                <input 
                  type="number" step="0.01" placeholder="Unit Price ($)" required
                  className="w-full bg-surface border border-border-subtle p-3 text-sm focus:outline-none focus:border-gray-400 rounded-none transition"
                  value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-white text-black font-semibold tracking-wide text-xs uppercase p-3 hover:bg-gray-200 transition rounded-none">
                Commit Entry to Inventory
              </button>
            </form>
          </div>

          {/* Action 2: Process Deductive Sales */}
          <div className="bg-panel border border-border-subtle p-6 rounded-none">
            <h2 className="text-sm font-semibold tracking-wider uppercase mb-4 text-text-secondary">2. Register Point-of-Sale Deduction</h2>
            <form onSubmit={handleLogSale} className="space-y-4">
              <select 
                required className="w-full bg-surface border border-border-subtle p-3 text-sm text-text-secondary focus:outline-none focus:border-gray-400 rounded-none"
                value={newSale.product_id} onChange={e => setNewSale({...newSale, product_id: e.target.value})}
              >
                <option value="">Select Item out of Stock</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.quantity !== undefined ? p.quantity : p.stock || 0} units remaining)
                  </option>
                ))}
              </select>
              <input 
                type="number" placeholder="Units Sold" required min="1"
                className="w-full bg-surface border border-border-subtle p-3 text-sm focus:outline-none focus:border-gray-400 rounded-none transition"
                value={newSale.quantity_to_sell} onChange={e => setNewSale({...newSale, quantity_to_sell: e.target.value})}
              />
              <button type="submit" className="w-full bg-emerald-500 text-text-primary font-semibold tracking-wide text-xs uppercase p-3 hover:bg-emerald-600 transition rounded-none">
                Deduct Inventory & Log Revenue
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: HISTORICAL AUDIT & INVENTORY VIEW */}
        <div className="space-y-8">
          {/* Current Stock Metrics View */}
          <div className="bg-panel border border-border-subtle p-6 rounded-none">
            <h2 className="text-sm font-semibold tracking-wider uppercase mb-4 text-text-secondary">Active Stock Standings</h2>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
              {products.length === 0 ? (
                <div className="p-3 text-xs text-gray-600 italic font-mono">No active product listings found.</div>
              ) : (
                products.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-surface border border-[#252530]">
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                    <div className="text-right">
                      <span className="text-xs text-text-muted block font-mono">
                        {p.quantity !== undefined ? p.quantity : p.stock || 0} items available
                      </span>
                      <span className="text-xs text-text-muted block">
                        ${p.price ? parseFloat(p.price).toFixed(2) : "0.00"} / unit
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sales History Record */}
          <div className="bg-panel border border-border-subtle p-6 rounded-none">
            <h2 className="text-sm font-semibold tracking-wider uppercase mb-4 text-text-secondary">Historical Sales Ledger</h2>
            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
              {salesHistory.length === 0 ? (
                <div className="p-3 text-xs text-gray-600 italic font-mono">No historical metrics logged yet.</div>
              ) : (
                salesHistory.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3 bg-surface-hover border-l-2 border-emerald-500">
                    <div>
                      <span className="text-sm font-semibold text-text-primary block">{s.product_name || "Unknown Product"}</span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {s.sold_at ? new Date(s.sold_at).toLocaleString() : "Date N/A"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400 block">
                        +${s.total_revenue ? parseFloat(s.total_revenue).toFixed(2) : "0.00"}
                      </span>
                      <span className="text-[10px] text-text-muted block font-mono">
                        Deducted {s.quantity_sold || s.quantity || 0} units
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}