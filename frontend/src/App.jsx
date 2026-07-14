import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import SalesView from './components/SalesView';
import ReportsView from './components/ReportsView';
import LoginGate from './components/LoginGate';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('trader_token') || null);
  const [activePage, setActivePage] = useState('dashboard');
  
  // Theme state - initializes from localStorage or defaults to dark
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark for premium aesthetic
  });

  // Sync theme to root html element
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
    return <LoginGate onLogin={(savedToken) => {
      localStorage.setItem('trader_token', savedToken);
      setToken(savedToken);
    }} />;
  }

  const renderView = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardView token={token} />;
      case 'inventory': return <InventoryView token={token} />;
      case 'sales':     return <SalesView token={token} />;
      case 'reports':   return <ReportsView token={token} />;
      default:          return <DashboardView token={token} />;
    }
  };

  return (
    /* 🌟 FIX: Replaced hardcoded bg-[#09090b] text-white with CSS custom-property variables. 
       This allows the background and text colors to switch automatically based on the 'dark' class on <html> */
    <div className="flex min-h-screen bg-base text-text-primary font-sans transition-colors duration-300">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        onLogout={() => {
          localStorage.removeItem('trader_token');
          setToken(null);
        }} 
      />
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {renderView()}
      </main>
    </div>
  );
}