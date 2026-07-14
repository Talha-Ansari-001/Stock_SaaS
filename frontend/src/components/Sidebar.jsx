import React from 'react';

export default function Sidebar({ activePage, setActivePage, isDark, toggleTheme, onLogout }) {
  const links = [
    { id: 'dashboard', label: 'Overview Dashboard' },
    { id: 'inventory', label: 'Inventory Section' },
    { id: 'sales',     label: 'Sales Section' },
    { id: 'reports',   label: 'Reports Section' }
  ];

  return (
    <aside className="w-64 h-screen sticky top-0 shrink-0 p-6 flex flex-col justify-between bg-white/80 dark:bg-[#09090b]/60 backdrop-blur-md border-r border-zinc-200 dark:border-[#1f1f23] transition-all duration-300">
      <div>
        <div className="mb-10 px-2">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white uppercase font-sans">TRADER.OS</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 lowercase tracking-tight block mt-1 font-mono">saas_workspace</span>
        </div>
        <nav className="space-y-2">
          {links.map(link => (
            <button
              key={link.id}
              onClick={() => setActivePage(link.id)}
              className={`w-full text-left px-4 py-3 text-sm tracking-tight font-medium rounded-lg transition-all duration-300 ${
                activePage === link.id 
                  ? 'bg-zinc-900 text-white dark:bg-white/5 dark:text-white shadow-sm' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="space-y-2">
        <button 
          onClick={toggleTheme} 
          className="w-full flex items-center justify-between px-4 py-3 text-sm tracking-tight text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg transition-all duration-300 font-sans"
        >
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          <span className="text-[16px] leading-none">{isDark ? '☀️' : '🌙'}</span>
        </button>
        <button 
          onClick={onLogout} 
          className="w-full text-left px-4 py-3 text-sm tracking-tight text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 rounded-lg transition-all duration-300 font-sans"
        >
          Exit Workspace
        </button>
      </div>
    </aside>
  );
}