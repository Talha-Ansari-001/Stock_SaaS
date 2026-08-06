import { useState } from 'react';

export default function InventoryView({ token, products, isLoaded, refreshInventory }) {
  const [form, setForm] = useState({ 
    name: '', 
    quantity: '', 
    price: '', 
    buying_price: '', 
    default_unit: 'Bags',
    kg_per_unit: '50',
    supplier_name: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  
  // Mobile Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal tracking state structures
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const handleUnitChange = (newUnit) => {
    if (newUnit === 'Bags') {
      setForm(prev => ({
        ...prev,
        default_unit: newUnit,
        kg_per_unit: prev.kg_per_unit && prev.kg_per_unit !== '1' ? prev.kg_per_unit : '50'
      }));
    } else {
      setForm(prev => ({
        ...prev,
        default_unit: newUnit,
        kg_per_unit: '1.00'
      }));
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    setFormSuccess('');
    try {
      const parsedQty = parseFloat(form.quantity);
      if (isNaN(parsedQty) || parsedQty < 0) {
        setFormError('Please provide a valid non-negative quantity.');
        setIsSubmitting(false);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name,
          quantity: parsedQty,
          price: parseFloat(form.price),
          buying_price: parseFloat(form.buying_price),
          default_unit: form.default_unit,
          allowed_units: form.default_unit === 'Bags' ? 'Bags,Kg' : form.default_unit,
          kg_per_unit: form.default_unit === 'Bags' ? (parseFloat(form.kg_per_unit) || 50.00) : 1.00,
          supplier_name: form.supplier_name || null
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to add product. Please try again.');
        return;
      }
      setForm({ 
        name: '', 
        quantity: '', 
        price: '', 
        buying_price: '', 
        default_unit: 'Bags',
        kg_per_unit: '50', 
        supplier_name: '' 
      });
      setFormSuccess('Product provisioned successfully!');
      setTimeout(() => setFormSuccess(''), 3000);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/products/${deleteTarget.id}`, {
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

  const isBags = form.default_unit === 'Bags';
  const totalProducts = Array.isArray(products) ? products.length : 0;
  const totalStock = Array.isArray(products) 
    ? products.reduce((acc, p) => acc + parseFloat(p.quantity !== undefined ? p.quantity : p.stock || 0), 0)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease both' }}>

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Registry</h1>
          <p className="page-subtitle">Manage your product catalog and stock levels</p>
        </div>
        <div className="page-actions flex items-center gap-3">
          <span className="badge-modern brand hidden sm:inline-flex" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="bi bi-boxes me-1" /> {totalProducts} SKUs
          </span>
          <span className="badge-modern success hidden sm:inline-flex" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <i className="bi bi-stack me-1" /> {totalStock.toFixed(2)} units total
          </span>
          <button onClick={() => setIsModalOpen(true)} className="md:hidden btn-os primary sm">
            <i className="bi bi-plus-circle me-1" /> Add Product
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ── ADD PRODUCT FORM (Desktop) ── */}
        <div className="hidden md:block card-modern">
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-plus-circle me-2" style={{ color: 'var(--brand)' }} />
                Add New Product
              </h2>
              <p className="card-header-subtitle">Provision a new stock batch</p>
            </div>
          </div>
          <div className="card-body-modern">
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Product Name */}
              <div className="form-group">
                <label className="form-label-modern">Product Name / Label</label>
                <input
                  type="text"
                  placeholder="e.g. Sand (Reti) or Ambuja Cement"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="form-control-modern"
                />
              </div>

              {/* Supplier */}
              <div className="form-group">
                <label className="form-label-modern">Supplier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Trader A"
                  value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  className="form-control-modern"
                />
              </div>

              {/* Unit Type */}
              <div className="form-group">
                <label className="form-label-modern">Unit Type</label>
                <select
                  value={form.default_unit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="form-control-modern form-select-modern"
                >
                  <option value="Bags">Bags (Cement, Sand/Reti)</option>
                  <option value="Baraas">Baraas (Khadi, Bhusa)</option>
                  <option value="Piece">Piece (Bricks/Blocks)</option>
                  <option value="Pack">Pack (Chemicals/Fixit)</option>
                </select>
              </div>

              {/* Quantity + Kg Per Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label-modern">
                    {isBags ? 'Bags Qty' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    placeholder={isBags ? 'e.g. 100' : 'e.g. 5'}
                    required
                    min="0"
                    step="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="form-control-modern"
                  />
                </div>

                {isBags ? (
                  <div className="form-group">
                    <label className="form-label-modern">Kg / Unit</label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      required
                      min="1"
                      step="0.01"
                      value={form.kg_per_unit}
                      onChange={(e) => setForm({ ...form, kg_per_unit: e.target.value })}
                      className="form-control-modern"
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label-modern">Kg / Unit</label>
                    <input
                      type="text"
                      disabled
                      value="N/A (1.00)"
                      className="form-control-modern"
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    />
                  </div>
                )}
              </div>

              {/* Prices */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label-modern">Cost (Buy)</label>
                  <input
                    type="number"
                    placeholder="Cost/unit"
                    required
                    min="0"
                    step="0.01"
                    value={form.buying_price}
                    onChange={(e) => setForm({ ...form, buying_price: e.target.value })}
                    className="form-control-modern"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label-modern">Sell Price</label>
                  <input
                    type="number"
                    placeholder="Retail price"
                    required
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="form-control-modern"
                  />
                </div>
              </div>

              {/* Feedback */}
              {formError && (
                <div className="alert-modern danger">
                  <i className="bi bi-exclamation-circle-fill" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="alert-modern success">
                  <i className="bi bi-check-circle-fill" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-os primary full"
                style={{ marginTop: '4px' }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Adding...
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-lg" /> Add to Inventory
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── PRODUCTS TABLE ── */}
        <div className="card-modern" style={{ overflow: 'hidden' }}>
          <div className="card-header-modern">
            <div>
              <h2 className="card-header-title">
                <i className="bi bi-table me-2" style={{ color: 'var(--brand)' }} />
                Stock Catalog
              </h2>
              <p className="card-header-subtitle">
                {isLoaded ? `${totalProducts} products registered` : 'Loading...'}
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Buy Price</th>
                  <th>Sell Price</th>
                  <th>Total Weight</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!isLoaded ? (
                  <tr>
                    <td colSpan="6">
                      <div className="loading-state" style={{ padding: '32px' }}>
                        <div className="spinner-modern" />
                        <p className="loading-text">Synchronizing inventory...</p>
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <i className="bi bi-inbox empty-state-icon" />
                        <p className="empty-state-title">No products yet</p>
                        <p className="empty-state-text">Add your first product using the form on the left</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const quantity = parseFloat(p.quantity !== undefined ? p.quantity : p.stock || 0);
                    const unit = p.default_unit || 'Bags';
                    const isBagsUnit = unit === 'Bags';
                    const kgPerUnit = parseFloat(p.kg_per_unit) || 1.00;
                    const totalWeight = isBagsUnit ? (quantity * kgPerUnit).toFixed(2) : null;
                    const isLowStock = quantity > 0 && quantity < 10;
                    
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="td-primary">{p.name}</div>
                          {p.supplier_name && (
                            <div className="td-sub">
                              <i className="bi bi-building me-1" style={{ fontSize: '10px' }} />
                              {p.supplier_name}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', color: quantity === 0 ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--text-primary)', fontFamily: 'Roboto Mono, monospace' }}>
                              {quantity.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {unit} {isBagsUnit ? `(${kgPerUnit}Kg)` : ''}
                            </span>
                          </div>
                          {quantity === 0 && (
                            <div style={{ marginTop: '3px' }}>
                              <span className="badge-modern danger" style={{ fontSize: '10px', padding: '2px 8px' }}>Out of Stock</span>
                            </div>
                          )}
                          {isLowStock && (
                            <div style={{ marginTop: '3px' }}>
                              <span className="badge-modern warning" style={{ fontSize: '10px', padding: '2px 8px' }}>Low Stock</span>
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          ₹{parseFloat(p.buying_price || 0).toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          ₹{parseFloat(p.price || 0).toLocaleString()}
                        </td>
                        <td>
                          {isBagsUnit ? (
                            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '12.5px', color: 'var(--success)', fontWeight: '600' }}>
                              {totalWeight} Kg
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="btn-os ghost sm"
                            style={{ color: 'var(--danger)', padding: '6px 8px' }}
                            title="Delete product"
                          >
                            <i className="bi bi-trash3" />
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

      {/* ── MOBILE ADD PRODUCT MODAL ── */}
      {isModalOpen && (
        <div className="modal-backdrop-modern md:hidden">
          <div className="modal-card-modern" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="modal-header-modern" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="modal-title-modern">
                  <i className="bi bi-plus-circle me-2" style={{ color: 'var(--brand)' }} />
                  Add New Product
                </h3>
                <p className="modal-subtitle-modern">Provision a new stock batch</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="btn-os ghost sm"><i className="bi bi-x-lg" /></button>
            </div>
            
            <form onSubmit={async (e) => { await handleAdd(e); if(!formError) setIsModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label-modern">Product Name / Label</label>
                <input type="text" placeholder="e.g. Sand (Reti) or Ambuja Cement" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="form-control-modern" />
              </div>

              <div className="form-group">
                <label className="form-label-modern">Supplier Name</label>
                <input type="text" placeholder="e.g. Trader A" value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} className="form-control-modern" />
              </div>

              <div className="form-group">
                <label className="form-label-modern">Unit Type</label>
                <select value={form.default_unit} onChange={(e) => handleUnitChange(e.target.value)} className="form-control-modern form-select-modern">
                  <option value="Bags">Bags (Cement, Sand/Reti)</option>
                  <option value="Baraas">Baraas (Khadi, Bhusa)</option>
                  <option value="Piece">Piece (Bricks/Blocks)</option>
                  <option value="Pack">Pack (Chemicals/Fixit)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label-modern">{isBags ? 'Bags Qty' : 'Quantity'}</label>
                  <input type="number" placeholder={isBags ? 'e.g. 100' : 'e.g. 5'} required min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="form-control-modern" />
                </div>
                {isBags ? (
                  <div className="form-group">
                    <label className="form-label-modern">Kg / Unit</label>
                    <input type="number" placeholder="e.g. 50" required min="1" step="0.01" value={form.kg_per_unit} onChange={(e) => setForm({ ...form, kg_per_unit: e.target.value })} className="form-control-modern" />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label-modern">Kg / Unit</label>
                    <input type="text" disabled value="N/A (1.00)" className="form-control-modern" style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label-modern">Cost (Buy)</label>
                  <input type="number" placeholder="Cost/unit" required min="0" step="0.01" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} className="form-control-modern" />
                </div>
                <div className="form-group">
                  <label className="form-label-modern">Sell Price</label>
                  <input type="number" placeholder="Retail price" required min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="form-control-modern" />
                </div>
              </div>

              {formError && (
                <div className="alert-modern danger"><i className="bi bi-exclamation-circle-fill" /><span>{formError}</span></div>
              )}

              <button type="submit" disabled={isSubmitting} className="btn-os primary full" style={{ marginTop: '4px' }}>
                {isSubmitting ? 'Adding...' : <><i className="bi bi-plus-lg" /> Add to Inventory</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteTarget && (
        <div className="modal-backdrop-modern">
          <div className="modal-card-modern" style={{ maxWidth: '400px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'var(--danger-light)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', marginBottom: '16px',
            }}>
              <i className="bi bi-trash3-fill" />
            </div>
            <div className="modal-header-modern">
              <h3 className="modal-title-modern">Delete Product?</h3>
              <p className="modal-subtitle-modern">
                Are you sure you want to permanently delete{' '}
                <strong style={{ color: 'var(--text-primary)' }}>"{deleteTarget.name}"</strong>?
                This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="alert-modern danger" style={{ marginBottom: '12px' }}>
                <i className="bi bi-exclamation-circle-fill" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="modal-actions-modern">
              <button
                disabled={isDeleting}
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                className="btn-os outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteExecute}
                className="btn-os danger"
                style={{ flex: 1 }}
              >
                {isDeleting ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash3" /> Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .inventory-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}