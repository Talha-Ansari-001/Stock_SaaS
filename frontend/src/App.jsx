import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import SalesView from './components/SalesView';
import ReportsView from './components/ReportsView';
import ExpensesView from './components/ExpensesView'; // 💸 Imported Expenses Engine
import LoginGate from './components/LoginGate';

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
    return saved ? saved === 'dark' : true;
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
    } catch (err) {
      console.error('Inventory cache synchronization critical failure:', err);
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
          <SalesView
            token={token}
            products={products}
            isLoaded={isInventoryLoaded}
            refreshInventory={async () => {
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

  return (
    <div className="min-h-screen flex bg-base text-text-primary transition-colors duration-200">
      
      {/* MOBILE APPLICATION HEADER INTERACTIVE LAYER */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-panel border-b border-border-subtle flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-text-primary animate-pulse" />
          <span className="font-sans font-bold text-sm tracking-tight text-text-primary">TRADER//OS</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* RESPONSIVE NAVIGATION SHELL BLOCK */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform bg-panel border-r border-border-subtle lg:static lg:translate-x-0 transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
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
      </div>

      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden" />
      )}

      {/* MAIN CONTENT FRAME WORKSPACE */}
      <main className="flex-1 w-full p-4 sm:p-6 md:p-8 lg:p-10 mx-auto max-w-7xl pt-24 lg:pt-10 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}