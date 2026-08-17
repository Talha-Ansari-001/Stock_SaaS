import { useState, useEffect } from 'react';

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
  return num % 1 === 0
    ? `₹${num.toLocaleString('en-IN')}`
    : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    } catch {
      alert("Failed to write inventory asset.");
    }
  };

  const handleSaleComplete = async () => {
    await triggerRefresh();
  };

  // 🧮 FIXED ARITHMETIC METRICS MATRIX (IMPROVED ACCURACY)

  // 1. Total Billed (Net Billed Revenue = total_revenue - amount_refunded)
  const totalBilled = salesHistory.reduce((acc, sale) => {
    const rev = parseFloat(sale.total_revenue) || 0;
    const ref = parseFloat(sale.amount_refunded) || 0;
    return acc + Math.max(0, rev - ref);
  }, 0);

  // 2. Received (Net amount paid in cash, which is already net of cash refunds in DB)
  const receivedCash = salesHistory.reduce((acc, sale) => {
    const rev = parseFloat(sale.total_revenue) || 0;
    let paid = sale.amount_paid;
    if (paid === undefined || paid === null || sale.payment_status === 'Paid') {
      paid = sale.amount_paid ?? rev;
    }
    return acc + (parseFloat(paid) || 0);
  }, 0);

  // 3. Dues Pending (Calculated per-sale to ensure accuracy: Max(0, total - paid - refunded))
  const duesPending = salesHistory.reduce((acc, sale) => {
    const total = parseFloat(sale.total_revenue) || 0;
    let paid = sale.amount_paid;
    if (paid === undefined || paid === null || sale.payment_status === 'Paid') {
      paid = sale.amount_paid ?? total;
    }
    const refunded = parseFloat(sale.amount_refunded) || 0;
    const due = Math.max(0, total - (parseFloat(paid) || 0) - refunded);
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
      const netSaleRev = (parseFloat(sale.total_revenue) || 0) - (parseFloat(sale.amount_refunded) || 0);
      return acc + Math.max(0, netSaleRev);
    }
    return acc;
  }, 0);

  // 6. Volumetric Stock Evaluation (Accurate float aggregation)
  const totalStockBags = products.reduce((acc, p) => acc + (parseFloat(p.quantity !== undefined ? p.quantity : p.stock) || 0), 0);
  const activeSKUs = products.length;

  // Top Products Analytics (Net Revenue by Product)
  const productRevenueMap = {};
  salesHistory.forEach(sale => {
    let name = sale.product_name;
    if (!name) {
      const matchedProduct = products.find(p => p.id === sale.product_id);
      name = matchedProduct?.name || "Uncategorized Product";
    }
    const rev = parseFloat(sale.total_revenue) || 0;
    const ref = parseFloat(sale.amount_refunded) || 0;
    const netRev = Math.max(0, rev - ref);
    productRevenueMap[name] = (productRevenueMap[name] || 0) + netRev;
  });

  const topProducts = Object.keys(productRevenueMap).map(name => ({
    name,
    revenue: productRevenueMap[name]
  })).sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.revenue)) : 0;

  // Loading State
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner-modern" />
        <p className="loading-text">Synchronizing dashboard data...</p>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div className="card-modern" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body-modern" style={{ textAlign: 'center', padding: '32px' }}>
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '40px', color: 'var(--danger)', marginBottom: '12px', display: 'block' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Connection Error</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{error}</p>
            <button onClick={triggerRefresh} className="btn-os primary">
              <i className="bi bi-arrow-clockwise" /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Billed',
      value: `₹${totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'bi-currency-rupee',
      iconClass: 'success',
      cardClass: 'success',
      footer: 'Net order totals',
    },
    {
      label: 'Cash Received',
      value: `₹${receivedCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'bi-wallet2',
      iconClass: 'info',
      cardClass: 'info',
      footer: 'Cash in hand',
    },
    {
      label: 'Dues Pending',
      value: `₹${duesPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'bi-clock-history',
      iconClass: 'warning',
      cardClass: 'warning',
      footer: 'Credit / Unpaid',
    },
    {
      label: 'Net Profit',
      value: `₹${Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: netProfit >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow',
      iconClass: netProfit >= 0 ? 'success' : 'danger',
      cardClass: netProfit >= 0 ? 'success' : 'danger',
      footer: netProfit >= 0 ? 'Profit this period' : 'Loss this period',
      valueClass: netProfit >= 0 ? 'success' : 'danger',
    },
    {
      label: "Today's Sales",
      value: `₹${todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: 'bi-calendar-check',
      iconClass: 'purple',
      cardClass: 'purple',
      footer: 'Net revenue today',
    },
    {
      label: 'Stock (Bags)',
      value: totalStockBags % 1 === 0 ? totalStockBags.toFixed(0) : totalStockBags.toFixed(2),
      icon: 'bi-boxes',
      iconClass: 'neutral',
      cardClass: 'brand',
      footer: `${activeSKUs} active SKUs`,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease both' }}>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">Live business overview & key metrics</p>
        </div>
        <div className="page-actions">
          <button onClick={triggerRefresh} className="btn-os outline sm">
            <i className="bi bi-arrow-clockwise" /> Refresh
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {statCards.map((card, i) => (
          <div key={i} className={`stat-card ${card.cardClass}`} style={{ animationDelay: `${i * 0.05}s` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className={`stat-icon ${card.iconClass}`}>
                <i className={`bi ${card.icon}`} />
              </div>
            </div>
            <div>
              <div className="stat-label">{card.label}</div>
              <div className={`stat-value ${card.valueClass || ''}`}>{card.value}</div>
              <div className="stat-footer">{card.footer}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── ANALYTICS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

        {/* Top Products Card */}
        <div className="card-modern">
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-trophy me-2" style={{ color: 'var(--warning)' }} />
                Top Products
              </h2>
              <p className="card-header-subtitle">By revenue generated</p>
            </div>
          </div>
          <div className="card-body-modern">
            {topProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 16px' }}>
                <i className="bi bi-bar-chart empty-state-icon" />
                <p className="empty-state-title">No revenue data yet</p>
                <p className="empty-state-text">Sales data will appear here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {topProducts.slice(0, 5).map((p, idx) => {
                  const percentage = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0;
                  const colors = ['brand', 'success', 'warning', 'info', 'purple'];
                  const colorClass = colors[idx % colors.length];
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            background: 'var(--brand-light)', color: 'var(--brand)',
                            fontSize: '10px', fontWeight: '700',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {p.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-secondary)', fontFamily: 'Roboto Mono, monospace' }}>
                          ₹{p.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div
                          className={`progress-bar-fill ${colorClass}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions Card */}
        <div className="card-modern">
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-clock-history me-2" style={{ color: 'var(--brand)' }} />
                Recent Transactions
              </h2>
              <p className="card-header-subtitle">Latest 5 sales</p>
            </div>
          </div>
          <div style={{ overflow: 'hidden' }}>
            {salesHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 16px' }}>
                <i className="bi bi-receipt empty-state-icon" />
                <p className="empty-state-title">No transactions yet</p>
                <p className="empty-state-text">Completed sales will appear here</p>
              </div>
            ) : (
              salesHistory.slice(0, 5).map((sale, idx) => (
                <div key={sale.id || idx} className="list-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'var(--success-light)', color: 'var(--success)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: '15px',
                    }}>
                      <i className="bi bi-bag-check" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {sale.product_name || products.find(p => p.id === sale.product_id)?.name || "Uncategorized Product"}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {formatSaleTimestamp(sale.sold_at)}
                        {sale.buyer_name ? ` · ${sale.buyer_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--success)', fontFamily: 'Roboto Mono, monospace', flexShrink: 0 }}>
                    +₹{parseFloat(sale.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── INVENTORY QUICK SNAPSHOT ── */}
      {/* <div className="card-modern">
        <div className="card-header-modern">
          <div>
            <h2 className="card-header-title">
              <i className="bi bi-boxes me-2" style={{ color: 'var(--brand)' }} />
              Inventory Snapshot
            </h2>
            <p className="card-header-subtitle">Current stock levels — {activeSKUs} SKUs</p>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-modern">
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock</th>
                <th>Total Weight</th>
                <th>Buy Price</th>
                <th>Sell Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    <i className="bi bi-inbox" style={{ fontSize: '24px', display: 'block', marginBottom: '8px', opacity: 0.4 }} />
                    No products in inventory
                  </td>
                </tr>
              ) : (
                products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="td-primary">{p.name}</div>
                      <div className="td-sub">{p.supplier_name || 'No supplier'}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace' }}>
                        {parseFloat(p.quantity || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        {p.default_unit || 'Bags'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '12.5px' }}>
                      {(parseFloat(p.quantity || 0) * parseFloat(p.kg_per_unit || 1)).toFixed(2)} Kg
                    </td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '12.5px' }}>
                      {formatCurrency(p.buying_price)}
                    </td>
                    <td style={{ fontFamily: 'Roboto Mono, monospace', fontWeight: '600', color: 'var(--text-primary)', fontSize: '12.5px' }}>
                      {formatCurrency(p.price)}
                    </td>
                    <td>
                      {parseFloat(p.quantity || 0) > 0 ? (
                        <span className="badge-modern success">
                          <i className="bi bi-circle-fill" style={{ fontSize: '6px' }} /> In Stock
                        </span>
                      ) : (
                        <span className="badge-modern danger">
                          <i className="bi bi-circle-fill" style={{ fontSize: '6px' }} /> Out of Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div> */}

    </div>
  );
}