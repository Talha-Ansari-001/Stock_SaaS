import React, { useState, useEffect } from 'react';

const formatSaleTimestamp = (dateStr) => {
  if (!dateStr) return "Timestamps offline";
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString('en-IN', { month: 'short' });
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const time = `${hours}:${minutes} ${ampm}`;
  return `${day} ${month}, ${time}`;
};

const formatCurrency = (val) => {
  const num = parseFloat(val || 0);
  return num % 1 === 0 ? `₹${num.toFixed(0)}` : `₹${num.toFixed(2)}`;
};

export default function TraderDashboard({ 
  token,
  products: propProducts,
  salesHistory: propSalesHistory,
  expenses: propExpenses,
  isLoaded,
  refreshProducts,
  refreshSales,
  refreshExpenses
}) {
  
  const [localProducts, setLocalProducts] = useState([]);
  const [localSalesHistory, setLocalSalesHistory] = useState([]);
  const [localExpenses, setLocalExpenses] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [localError, setLocalError] = useState(null);

  const products = propProducts !== undefined ? propProducts : localProducts;
  const salesHistory = propSalesHistory !== undefined ? propSalesHistory : localSalesHistory;
  const expenses = propExpenses !== undefined ? propExpenses : localExpenses;
  const loading = propProducts !== undefined ? !isLoaded : localLoading;
  const error = localError;
  
  // Form States
  const [newProduct, setNewProduct] = useState({ name: '', quantity: '', price: '' });
  const [newSale, setNewSale] = useState({ product_id: '', quantity_to_sell: '' });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const loadData = async () => {
    try {
      setLocalLoading(true);
      setLocalError(null);

      // Concurrent data fetching matrix
      const [prodRes, salesRes, expRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/products`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/history`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses`, { headers })
      ]);

      if (!prodRes.ok) throw new Error(`Products server fault: ${prodRes.status}`);
      if (!salesRes.ok) throw new Error(`Sales server fault: ${salesRes.status}`);
      
      const prodData = await prodRes.json();
      const salesData = await salesRes.json();
      
      setLocalProducts(Array.isArray(prodData) ? prodData : []);
      setLocalSalesHistory(Array.isArray(salesData) ? salesData : []);

      // Gracefully handle expense tracking if backend table verification is pending
      if (expRes.ok) {
        const expData = await expRes.json();
        setLocalExpenses(Array.isArray(expData) ? expData : (expData.expenses || []));
      } else {
        setLocalExpenses([]);
      }

    } catch (err) {
      console.error("Error syncing dashboard parameters:", err);
      setLocalError(err.message);
    } finally {
      setLocalLoading(false);
    }
  };

  const triggerRefresh = async () => {
    if (propProducts !== undefined) {
      const promises = [];
      if (refreshProducts) promises.push(refreshProducts());
      if (refreshSales) promises.push(refreshSales());
      if (refreshExpenses) promises.push(refreshExpenses());
      await Promise.all(promises);
    } else {
      await loadData();
    }
  };

  useEffect(() => {
    if (propProducts !== undefined) {
      return;
    }
    if (token) {
      loadData();
    } else {
      setLocalError("Missing active authorization context.");
      setLocalLoading(false);
    }
  }, [token, propProducts]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        setNewProduct({ name: '', quantity: '', price: '' });
        await triggerRefresh();
      }
    } catch (err) {
      alert("Failed to write inventory asset.");
    }
  };

  const handleLogSale = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newSale)
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setNewSale({ product_id: '', quantity_to_sell: '' });
        await triggerRefresh();
      }
    } catch (err) {
      alert("Failed to execute deductive sale transaction.");
    }
  };

  // 🧮 FIXED ARITHMETIC METRICS MATRIX (IMPROVED ACCURACY)
  
  // 1. Total Billed (Net Billed Revenue = total_revenue - amount_refunded)
  const totalBilled = salesHistory.reduce((acc, sale) => {
    const rev = parseFloat(sale.total_revenue || 0);
    const ref = parseFloat(sale.amount_refunded || 0);
    return acc + Math.max(0, rev - ref);
  }, 0);

  // 2. Received (Net amount paid in cash, which is already net of cash refunds in DB)
  const receivedCash = salesHistory.reduce((acc, sale) => {
    return acc + parseFloat(sale.amount_paid || 0);
  }, 0);
  
  // 3. Dues Pending (Calculated per-sale to ensure accuracy: Max(0, total - paid - refunded))
  const duesPending = salesHistory.reduce((acc, sale) => {
    const total = parseFloat(sale.total_revenue || 0);
    const paid = parseFloat(sale.amount_paid || 0);
    const refunded = parseFloat(sale.amount_refunded || 0);
    const due = Math.max(0, total - paid - refunded);
    return acc + due;
  }, 0);

  // 4. Net Profit/Loss Calculation (Net Billed Revenue - COGS - Active Expenses)
  const totalCOGS = salesHistory.reduce((acc, sale) => {
    const product = products.find(p => p.id === sale.product_id);
    if (product) {
      const kgPerUnit = parseFloat(product.kg_per_unit || 1);
      const buyingPrice = parseFloat(product.buying_price || 0);
      const qtySold = parseFloat(sale.quantity_sold || 0);
      const qtyReturned = parseFloat(sale.quantity_returned || 0);
      const netQty = Math.max(0, qtySold - qtyReturned);
      
      const bagsSold = sale.quantity_unit === 'Kg' ? (netQty / kgPerUnit) : netQty;
      const cogs = bagsSold * buyingPrice;
      return acc + cogs;
    }
    return acc;
  }, 0);

  const totalExpenses = expenses.reduce((acc, exp) => acc + parseFloat(exp.amount || 0), 0);
  const netProfit = totalBilled - totalCOGS - totalExpenses;

  // 5. Today's Sales Activity Tracker (Net Sales today)
  const todaySales = salesHistory.reduce((acc, sale) => {
    if (!sale.sold_at) return acc;
    const saleDate = new Date(sale.sold_at).toDateString();
    const todayDate = new Date().toDateString();
    if (saleDate === todayDate) {
      const netSaleRev = parseFloat(sale.total_revenue || 0) - parseFloat(sale.amount_refunded || 0);
      return acc + Math.max(0, netSaleRev);
    }
    return acc;
  }, 0);

  // 6. Volumetric Stock Evaluation (Accurate float aggregation)
  const totalStockBags = products.reduce((acc, p) => acc + parseFloat(p.quantity !== undefined ? p.quantity : p.stock || 0), 0);
  const activeSKUs = products.length;

  // Top Products Analytics (Net Revenue by Product)
  const productRevenueMap = {};
  salesHistory.forEach(sale => {
    const name = sale.product_name || "Unknown Product";
    const netRev = parseFloat(sale.total_revenue || 0) - parseFloat(sale.amount_refunded || 0);
    productRevenueMap[name] = (productRevenueMap[name] || 0) + Math.max(0, netRev);
  });

  const topProducts = Object.keys(productRevenueMap).map(name => ({
    name,
    revenue: productRevenueMap[name]
  })).sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.revenue)) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0c0c0e] text-zinc-400 flex items-center justify-center font-mono text-xs uppercase tracking-widest">
        Synchronizing Command Center Ledger Workspace...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0c0c0e] text-red-500 flex flex-col items-center justify-center p-4">
        <div className="border border-red-200 dark:border-red-950/40 bg-white dark:bg-[#121214] p-6 max-w-md w-full text-center rounded-xl shadow-sm">
          <h2 className="text-xs font-mono font-bold tracking-wider uppercase mb-2">Workspace Error Boundary</h2>
          <p className="text-xs text-zinc-500 font-mono break-words bg-zinc-50 dark:bg-zinc-900 p-3 rounded mb-4">{error}</p>
          <button onClick={triggerRefresh} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-2 rounded-lg text-xs font-mono transition-all uppercase font-semibold">
            Retry Connection Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Dashboard Top Title Bar */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">Command Center</h1>
        <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">overview / live_metrics_dashboard</p>
      </header>

      {/* 📊 WIDGET CONTROL GRID (6 INTERFACES) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Total Billed */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] p-4 rounded-xl shadow-sm flex flex-col justify-between min-h-[115px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">Total Billed</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-500 text-xs">💵</div>
          </div>
          <div className="my-2">
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 lowercase">Order totals</span>
        </div>

        {/* Card 2: Received */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] p-4 rounded-xl shadow-sm flex flex-col justify-between min-h-[115px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">Received</span>
            <div className="p-1.5 bg-teal-50 dark:bg-teal-950/30 rounded-lg text-teal-500 text-xs">📊</div>
          </div>
          <div className="my-2">
            <span className="text-lg font-bold font-mono text-teal-600 dark:text-teal-400">
              ₹{receivedCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 lowercase">Cash in hand</span>
        </div>

        {/* Card 3: Dues Pending */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] p-4 rounded-xl shadow-sm flex flex-col justify-between min-h-[115px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">Dues Pending</span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-500 text-xs">⚠️</div>
          </div>
          <div className="my-2">
            <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-500">
              ₹{duesPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 lowercase">Credit / Unpaid</span>
        </div>

        {/* Card 4: Net Profit or Dynamic Loss */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] p-4 rounded-xl shadow-sm flex flex-col justify-between min-h-[115px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">Net Profit</span>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-blue-500 text-xs">📈</div>
          </div>
          <div className="my-2">
            <span className={`text-lg font-bold font-mono ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              ₹{Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 lowercase">
            {netProfit >= 0 ? 'Profit' : 'Loss'}
          </span>
        </div>

        {/* Card 5: Today's Sales */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] p-4 rounded-xl shadow-sm flex flex-col justify-between min-h-[115px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">Today's Sales</span>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-purple-500 text-xs">📅</div>
          </div>
          <div className="my-2">
            <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
              ₹{todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 lowercase">Today</span>
        </div>

        {/* Card 6: Stock Standing Metrics */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] p-4 rounded-xl shadow-sm flex flex-col justify-between min-h-[115px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">Stock (Bags)</span>
            <div className="p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-500 text-xs">📦</div>
          </div>
          <div className="my-2">
            <span className="text-lg font-bold font-mono text-zinc-800 dark:text-zinc-200">
              {totalStockBags % 1 === 0 ? totalStockBags.toFixed(0) : totalStockBags.toFixed(2)}
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 lowercase">{activeSKUs} SKUs active</span>
        </div>
      </div>

      {/* 📊 MIDDLE ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Card */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl shadow-sm p-6 text-left flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">Top Products</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono lowercase mb-6">by revenue generated</p>
            
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono italic py-4">No revenue generated yet.</div>
              ) : (
                topProducts.slice(0, 5).map((p, idx) => {
                  const percentage = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                        <span className="font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
                          ₹{p.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions Card */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl shadow-sm p-6 text-left flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">Recent Transactions</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono lowercase mb-6">last 3 sales</p>
            
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {salesHistory.length === 0 ? (
                <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono italic py-4">No recent sales recorded.</div>
              ) : (
                salesHistory.slice(0, 3).map((sale, idx) => (
                  <div key={sale.id || idx} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block">{sale.product_name || "Catalog Product Asset"}</span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono block">
                        {formatSaleTimestamp(sale.sold_at)}{sale.buyer_name ? ` · ${sale.buyer_name}` : ''}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      +₹{parseFloat(sale.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📊 BOTTOM INVENTORY SNAPSHOT CARD */}
      <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl shadow-sm p-6 text-left">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">Inventory Snapshot</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono lowercase mb-6">current stock levels</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-3 text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Product</th>
                <th className="pb-3 text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Stock</th>
                <th className="pb-3 text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Total Kg</th>
                <th className="pb-3 text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Buy Price</th>
                <th className="pb-3 text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Sell Price</th>
                <th className="pb-3 text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {products.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500 font-mono italic">
                    No products cataloged in inventory.
                  </td>
                </tr>
              ) : (
                products.map(p => (
                  <tr key={p.id} className="hover:bg-zinc-50/40 dark:hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{p.name}</div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{p.supplier_name || 'No Supplier'}</div>
                    </td>
                    <td className="py-4 font-mono text-zinc-600 dark:text-zinc-300 text-sm">
                      {parseFloat(p.quantity || 0).toFixed(2)} bags
                    </td>
                    <td className="py-4 font-mono text-zinc-600 dark:text-zinc-300 text-sm">
                      {(parseFloat(p.quantity || 0) * parseFloat(p.kg_per_unit || 1)).toFixed(2)} Kg
                    </td>
                    <td className="py-4 font-mono text-zinc-600 dark:text-zinc-300 text-sm">
                      {formatCurrency(p.buying_price)}
                    </td>
                    <td className="py-4 font-mono text-zinc-600 dark:text-zinc-300 text-sm">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="py-4">
                      {parseFloat(p.quantity || 0) > 0 ? (
                        <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                          In Stock
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                          Out of Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}