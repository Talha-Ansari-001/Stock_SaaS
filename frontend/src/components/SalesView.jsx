import React, { useState, useEffect } from 'react';

export default function SalesView({ token }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ 
    product_id: '', 
    quantity_to_sell: '',
    buyer_name: '',
    buyer_contact: '',
    quantity_unit: 'Kg',
    payment_method: 'Cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const loadList = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/products', { headers });
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Product manifest sync failure:', err);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => { loadList(); }, []);

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) {
        setFeedback({ type: 'error', message: data.error });
      } else {
        setFeedback({ type: 'success', message: 'Transaction executed successfully.' });
        setForm({ 
          product_id: '', 
          quantity_to_sell: '',
          buyer_name: '',
          buyer_contact: '',
          quantity_unit: 'Kg',
          payment_method: 'Cash'
        });
      }
      await loadList();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network failure.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  return (
    <div className={`space-y-10 transition-all duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      <header className="space-y-1 text-left max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white font-sans">
          Sales Terminal
        </h1>
        <p className="text-sm tracking-tight text-zinc-500 dark:text-zinc-400 font-mono lowercase">
          transaction / point_of_sale
        </p>
      </header>

      <div className="max-w-xl mx-auto">
        <form
          onSubmit={handleSaleSubmit}
          className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#1f1f23] rounded-xl p-8 space-y-6 shadow-sm dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] relative"
        >
          <div className="space-y-1 text-left mb-6">
            <h2 className="text-base font-medium tracking-tight text-zinc-900 dark:text-white font-sans">
              New Transaction
            </h2>
          </div>

          <div className="space-y-5">
            {/* Target Product */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-zinc-500 dark:text-zinc-400 font-sans block">Target Product</label>
              <select
                required
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-zinc-900 dark:text-white font-mono outline-none appearance-none cursor-pointer"
              >
                <option value="" disabled>Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.quantity !== undefined ? p.quantity : p.stock || 0} left)
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-white/5 rounded-lg border border-transparent dark:border-white/5">
                <span className="text-xs tracking-tight text-zinc-500 dark:text-zinc-400 font-sans">Available stock</span>
                <span className="text-sm font-mono font-medium text-[#10b981]">
                  {(selectedProduct.quantity !== undefined ? selectedProduct.quantity : selectedProduct.stock || 0).toLocaleString()}
                </span>
              </div>
            )}

            {/* Buyer Name & Contact Inline Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-zinc-500 dark:text-zinc-400 font-sans block">Buyer Name <span className="text-zinc-400 dark:text-zinc-600">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="Name"
                  value={form.buyer_name}
                  onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs tracking-tight text-zinc-500 dark:text-zinc-400 font-sans block">Contact Number <span className="text-zinc-400 dark:text-zinc-600">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="Phone"
                  value={form.buyer_contact}
                  onChange={(e) => setForm({ ...form, buyer_contact: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                />
              </div>
            </div>

            {/* Quantity and Unit Selector */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-zinc-500 dark:text-zinc-400 font-sans block">Units to Deduct</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Quantity"
                  required
                  min="1"
                  value={form.quantity_to_sell}
                  onChange={(e) => setForm({ ...form, quantity_to_sell: e.target.value })}
                  className="flex-1 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-500 rounded-lg transition-all px-4 py-3 text-sm text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
                />
                <select
                  value={form.quantity_unit}
                  onChange={(e) => setForm({ ...form, quantity_unit: e.target.value })}
                  className="w-24 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-500 rounded-lg transition-all px-3 py-3 text-sm text-zinc-900 dark:text-white font-mono outline-none appearance-none cursor-pointer"
                >
                  <option value="Kg">Kg</option>
                  <option value="Bags">Bags</option>
                </select>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs tracking-tight text-zinc-500 dark:text-zinc-400 font-sans block">Method Of Payment</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-lg">
                {['Cash', 'Online'].map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setForm({ ...form, payment_method: method })}
                    className={`py-2 text-xs font-mono tracking-tight rounded-md transition-all ${
                      form.payment_method === method 
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' 
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {feedback && (
            <div className={`p-3 rounded-lg text-xs font-mono tracking-tight transition-all ${
              feedback.type === 'success' 
                ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' 
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
            }`}>
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !form.product_id || !form.quantity_to_sell}
            className="w-full bg-[#10b981] text-white dark:text-[#09090b] font-medium text-sm tracking-tight rounded-lg p-3.5 transition-all duration-200 hover:bg-[#34d399] hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none mt-4"
          >
            {isSubmitting ? 'Processing...' : 'Execute Sale'}
          </button>
        </form>
      </div>
    </div>
  );
}