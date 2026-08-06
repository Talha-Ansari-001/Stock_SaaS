export default function Sidebar({ activePage, setActivePage, isDark, toggleTheme, onLogout }) {
  const links = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: 'bi-grid-1x2-fill' },
    { id: 'inventory', label: 'Inventory',           icon: 'bi-boxes' },
    { id: 'sales',     label: 'Sales Terminal',      icon: 'bi-cart3' },
    { id: 'expenses',  label: 'Expenses',            icon: 'bi-wallet2' },
    { id: 'reports',   label: 'Reports',             icon: 'bi-bar-chart-line-fill' },
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <i className="bi bi-activity" />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">TraderOS</span>
          <span className="sidebar-brand-sub">SaaS Workspace</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main Menu</div>
        {links.map(link => (
          <button
            key={link.id}
            onClick={() => setActivePage(link.id)}
            className={`sidebar-nav-item${activePage === link.id ? ' active' : ''}`}
          >
            <i className={`bi ${link.icon} nav-icon`} />
            <span className="nav-label">{link.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          onClick={toggleTheme}
          className="sidebar-footer-btn"
        >
          <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} style={{ width: 16, textAlign: 'center' }} />
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button
          onClick={onLogout}
          className="sidebar-footer-btn logout"
        >
          <i className="bi bi-box-arrow-left" style={{ width: 16, textAlign: 'center' }} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}