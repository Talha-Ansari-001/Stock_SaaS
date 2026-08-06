import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import SalesTerminal from './components/SalesTerminal';
import SalesView from './components/SalesView';
import ReportsView from './components/ReportsView';
import ExpensesView from './components/ExpensesView'; // 💸 Imported Expenses Engine
import LoginGate from './components/LoginGate';

const PAGE_META = {
  dashboard: { label: 'Overview Dashboard', icon: 'bi-grid-1x2-fill' },
  inventory:  { label: 'Inventory',          icon: 'bi-boxes' },
  sales:      { label: 'Sales Terminal',     icon: 'bi-cart3' },
  expenses:   { label: 'Expenses',           icon: 'bi-wallet2' },
  reports:    { label: 'Reports',            icon: 'bi-bar-chart-line-fill' },
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('trader_token') || null);
  const [activePage, setActivePage] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ⚡ CENTRALIZED INSTANT DATA CACHE STATE LIFTING
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [expenses, setExpenses] = useState([]); // Cache storage array for local tracking updates
  const [isInventoryLoaded, setIsInventoryLoaded] = useState(false);
  const [isSalesLoaded, setIsSalesLoaded] = useState(false);
  const [isExpensesLoaded, setIsExpensesLoaded] = useState(false);

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false; // default light
  });

  // Base Headers Setup
  const headers = React.useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  // ⚡ Fast Pre-fetch Functions
  const loadProducts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/products`, { headers });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      console.error('Inventory fetch failed');
    } finally {
      setIsInventoryLoaded(true);
    }
  }, [token, headers]);

  const loadSalesHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sales/history`, { headers });
      const data = await res.json();
      setSalesHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Sales ledger history matrix failure:', err);
    } finally {
      setIsSalesLoaded(true);
    }
  }, [token, headers]);

  const loadExpenses = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/expenses`, { headers });
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Expenses cache data layer sink failure:', err);
    } finally {
      setIsExpensesLoaded(true);
    }
  }, [token, headers]);

  // Handle systemic authentication storage states
  const handleLogin = (newToken) => {
    localStorage.setItem('trader_token', newToken);
    setToken(newToken);
    setActivePage('dashboard');
  };

  // Sync execution triggers upon state updates
  useEffect(() => {
    if (token) {
      loadProducts();
      loadSalesHistory();
      loadExpenses();
    }
  }, [token, loadProducts, loadSalesHistory, loadExpenses]);

  // Handle theme configurations
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  if (!token) {
    return <LoginGate onLogin={handleLogin} />;
  }

  // Render view engine selection switches
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardView
            token={token}
            products={products}
            salesHistory={salesHistory}
            expenses={expenses}
            isLoaded={isInventoryLoaded && isSalesLoaded && isExpensesLoaded}
            refreshProducts={loadProducts}
            refreshSales={loadSalesHistory}
            refreshExpenses={loadExpenses}
          />
        );
      case 'inventory':
        return (
          <InventoryView
            token={token}
            products={products}
            isLoaded={isInventoryLoaded}
            refreshInventory={loadProducts}
          />
        );
      case 'sales':
        return (
          <SalesTerminal
            token={token}
            products={products}
            isLoaded={isInventoryLoaded}
            onSaleComplete={async () => {
              await loadProducts();
              await loadSalesHistory();
            }}
          />
        );
      case 'reports':
        return (
          <ReportsView
            salesHistory={salesHistory}
            isLoaded={isSalesLoaded}
            refreshReports={async () => {
              await loadProducts();
              await loadSalesHistory();
            }}
            token={token}
          />
        );
      case 'expenses':
        return (
          <ExpensesView 
            token={token}
            expenses={expenses}
            isLoaded={isExpensesLoaded}
            refreshExpenses={loadExpenses}
          />
        );
      default:
        return <div className="text-sm font-mono p-6">View index reference context missing.</div>;
    }
  };

  const currentMeta = PAGE_META[activePage] || PAGE_META.dashboard;

  return (
    <div className="app-shell">
      
      {/* ── SIDEBAR ── */}
      <Sidebar
        activePage={activePage}
        setActivePage={(page) => {
          setActivePage(page);
          setMobileMenuOpen(false);
        }}
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        onLogout={() => {
          localStorage.removeItem('trader_token');
          setToken(null);
        }}
      />

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="app-main">
        
        {/* TOP NAVBAR */}
        <header className="app-navbar">
          {/* Left: Hamburger + Breadcrumb */}
          <div className="navbar-left">
            <button
              className="navbar-icon-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ display: 'none' }}
              id="mobile-menu-btn"
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} />
            </button>

            {/* Breadcrumb */}
            <nav className="navbar-breadcrumb" aria-label="breadcrumb">
              <i className="bi bi-house" />
              <span className="bc-sep">›</span>
              <span>TraderOS</span>
              <span className="bc-sep">›</span>
              <span className="bc-current">
                <i className={`bi ${currentMeta.icon} me-1`} />
                {currentMeta.label}
              </span>
            </nav>
          </div>

          {/* Right: Search + Actions */}
          <div className="navbar-right">
            {/* Search */}
            {/* <div className="navbar-search-wrap d-none d-md-block">
              <i className="bi bi-search navbar-search-icon" />
              <input
                type="search"
                className="navbar-search"
                placeholder="Search anything..."
              />
            </div> */}

            {/* Refresh */}
            <button
              className="navbar-icon-btn"
              title="Refresh data"
              onClick={() => {
                loadProducts();
                loadSalesHistory();
                loadExpenses();
              }}
            >
              <i className="bi bi-arrow-clockwise" />
            </button>

            {/* Notifications (UI only) */}
            <button className="navbar-icon-btn" title="Notifications" style={{ position: 'relative' }}>
              <i className="bi bi-bell" />
              <span style={{
                position: 'absolute',
                top: 4, right: 4,
                width: 7, height: 7,
                background: 'var(--danger)',
                borderRadius: '50%',
                border: '1.5px solid #fff'
              }} />
            </button>

            {/* Avatar */}
            <div className="navbar-avatar" title="Profile">
              T
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="app-content" key={activePage}>
          {renderContent()}
        </main>
      </div>

      {/* Inject mobile button visibility via style tag */}
      <style>{`
        @media (max-width: 1024px) {
          #mobile-menu-btn { display: flex !important; }
          .app-sidebar.open { transform: translateX(0) !important; }
        }
        .app-sidebar {
          transform: ${mobileMenuOpen ? 'translateX(0)' : ''};
        }
        @media (max-width: 1024px) {
          .app-sidebar { transform: ${mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)'}; }
        }
      `}</style>
    </div>
  );
}