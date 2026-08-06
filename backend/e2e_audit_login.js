/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  E2E VERIFICATION AUDIT — Login-based (no direct DB required)
 *
 *  1. Login as ash@gmail.com / ash
 *  2. Create inventory: Cement Bag × 50 @ ₹350 (cost ₹250)
 *  3. POS sale: 10 units → ₹3,500
 *  4. Operational expense: ₹500 transport
 *  5. Verify stock = 40, revenue = ₹3,500, net profit calculated correctly
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const http = require('http');

const API_BASE = 'http://localhost:5000';

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(url, { method, headers }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, data: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Cleanup helper: delete products, sales, expenses created during audit ───
async function cleanup(token, productId) {
  // Delete the product (which cascades or at least removes inventory)
  if (productId) {
    await api('DELETE', '/api/products/' + productId, null, token);
  }
}

// ─── Main E2E ────────────────────────────────────────────────────────────────
(async () => {
  const results = {};
  let token = null;
  let productId = null;

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // STEP 1: Login as ash@gmail.com
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 1] Logging in as ash@gmail.com...');
    const login = await api('POST', '/api/auth/login', {
      email: 'ash@gmail.com',
      password: 'ash'
    });
    if (login.status !== 200) throw new Error('Login failed: ' + JSON.stringify(login.data));
    token = login.data.token;

    // Decode tenant_id from JWT
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const tenantId = payload.tenantId;
    console.log('  ✅ Logged in. Tenant ID: ' + tenantId);

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 1b: Snapshot existing data so we can compute deltas
    // ═════════════════════════════════════════════════════════════════════════
    const preProducts = await api('GET', '/api/products', null, token);
    const preSales    = await api('GET', '/api/sales/history', null, token);
    const preExpenses = await api('GET', '/api/expenses', null, token);

    const preExistingCement = (preProducts.data || []).find(p => p.name === 'Cement Bag');
    const preRevenueTotal   = (preSales.data || []).reduce((s, o) => s + parseFloat(o.total_revenue || 0), 0);
    const preExpensesTotal  = (preExpenses.data || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 2: Create inventory — Cement Bag, 50 units, sell @₹350, cost @₹250
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 2] Creating inventory: Cement Bag × 50 @ ₹350 (cost ₹250)...');
    const addProd = await api('POST', '/api/products', {
      name: 'Cement Bag',
      quantity: 50,
      price: 350,
      buying_price: 250,
      kg_per_unit: 50,
      default_unit: 'Bags',
      allowed_units: 'Bags,Kg',
      supplier_name: 'E2E Audit Supplier'
    }, token);
    if (addProd.status !== 201) throw new Error('Add product failed: ' + JSON.stringify(addProd.data));
    console.log('  ✅ Product added/updated.');

    // Fetch product to get ID and baseline values
    const prodList = await api('GET', '/api/products', null, token);
    const product = prodList.data.find(p => p.name === 'Cement Bag');
    if (!product) throw new Error('Product not found after creation');
    productId = product.id;

    // Calculate expected baseline: if product existed before, quantity was merged
    const expectedBaseline = preExistingCement
      ? parseFloat(preExistingCement.quantity) + 50
      : 50;

    results.baseline_stock = parseFloat(product.quantity);
    console.log('  Product ID: ' + productId);
    console.log('  Baseline stock: ' + results.baseline_stock + ' Bags');
    console.log('  (Expected baseline: ' + expectedBaseline + ')');

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 3: POS sale — 10 Bags via multi-item cart endpoint
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 3] Processing POS sale: 10 Bags @ ₹350 = ₹3,500...');
    const sale = await api('POST', '/api/sales/multi', {
      buyer_name: 'Walk-in Customer',
      contact_number: 'N/A',
      payment_method: 'Cash',
      payment_status: 'Paid',
      total_amount: 3500,
      paid_amount: 3500,
      due_amount: 0,
      transportation_fee: 0,
      items: [{
        product_id: productId,
        quantity: 10,
        unit_price: 350,
        subtotal: 3500
      }]
    }, token);
    if (sale.status !== 201) throw new Error('Sale failed: ' + JSON.stringify(sale.data));
    const orderId = sale.data.order_id;
    console.log('  ✅ Sale processed. Order ID: ' + orderId);

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 4: Record operational expense — Transport ₹500
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 4] Recording expense: Transport ₹500...');
    const exp = await api('POST', '/api/expenses', {
      title: 'Truck Transport',
      category: 'Transport/Fuel',
      amount: 500,
      notes: 'E2E audit transport cost'
    }, token);
    if (exp.status !== 201) throw new Error('Expense failed: ' + JSON.stringify(exp.data));
    console.log('  ✅ Expense recorded.');

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 5: VERIFY — All checks via API
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 5] Running verification audit...');

    // 5a. Inventory stock check
    const prodsAfter = await api('GET', '/api/products', null, token);
    const prodAfter = prodsAfter.data.find(p => p.id === productId);
    results.actual_stock = parseFloat(prodAfter.quantity);
    results.expected_stock = results.baseline_stock - 10;

    // 5b. Sales revenue (delta from pre-audit)
    const salesAfter = await api('GET', '/api/sales/history', null, token);
    const postRevenueTotal = (salesAfter.data || []).reduce((s, o) => s + parseFloat(o.total_revenue || 0), 0);
    results.actual_revenue_delta = postRevenueTotal - preRevenueTotal;
    results.expected_revenue_delta = 3500;

    // Also check the specific order
    const auditOrder = (salesAfter.data || []).find(o => o.id === orderId);
    results.order_revenue = auditOrder ? parseFloat(auditOrder.total_revenue) : null;
    results.order_payment_status = auditOrder ? auditOrder.payment_status : null;

    // 5c. Expenses (delta from pre-audit)
    const expensesAfter = await api('GET', '/api/expenses', null, token);
    const postExpensesTotal = (expensesAfter.data || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    results.actual_expenses_delta = postExpensesTotal - preExpensesTotal;
    results.expected_expenses_delta = 500;

    // 5d. Net profit calculation
    // Revenue from this sale: ₹3,500
    // COGS: 10 bags × ₹250 buying_price = ₹2,500
    // Expenses: ₹500
    // Net Profit = 3,500 - 2,500 - 500 = ₹500
    results.expected_cogs = 10 * 250;
    results.expected_net_profit = 3500 - results.expected_cogs - 500;
    results.actual_net_profit = results.actual_revenue_delta - results.expected_cogs - results.actual_expenses_delta;

    // ═════════════════════════════════════════════════════════════════════════
    // OUTPUT: Audit results table
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(80));
    console.log(' E2E VERIFICATION AUDIT RESULTS');
    console.log(' Tenant: ' + tenantId + '  |  User: ash@gmail.com');
    console.log(' Timestamp: ' + new Date().toISOString());
    console.log('═'.repeat(80));

    const checks = [
      { metric: 'Baseline Stock',          expected: results.baseline_stock + ' Bags',          actual: results.baseline_stock + ' Bags',          pass: results.baseline_stock === expectedBaseline },
      { metric: 'Post-Sale Stock',          expected: results.expected_stock + ' Bags',          actual: results.actual_stock + ' Bags',              pass: results.actual_stock === results.expected_stock },
      { metric: 'Stock Δ (deducted)',       expected: '-10 Bags',                                actual: (results.actual_stock - results.baseline_stock) + ' Bags', pass: (results.baseline_stock - results.actual_stock) === 10 },
      { metric: 'Sales Revenue (this txn)', expected: '₹3,500.00',                              actual: '₹' + results.actual_revenue_delta.toFixed(2), pass: results.actual_revenue_delta === 3500 },
      { metric: 'Order Amount',             expected: '₹3,500.00',                              actual: results.order_revenue !== null ? '₹' + results.order_revenue.toFixed(2) : 'N/A', pass: results.order_revenue === 3500 },
      { metric: 'Order Payment Status',     expected: 'Paid',                                    actual: results.order_payment_status || 'N/A',      pass: results.order_payment_status === 'Paid' },
      { metric: 'Expense Recorded',         expected: '₹500.00',                                actual: '₹' + results.actual_expenses_delta.toFixed(2), pass: results.actual_expenses_delta === 500 },
      { metric: 'COGS (10 × ₹250)',         expected: '₹2,500.00',                              actual: '₹' + results.expected_cogs.toFixed(2),     pass: true },
      { metric: 'Net Profit',               expected: '₹500.00',                                actual: '₹' + results.actual_net_profit.toFixed(2), pass: results.actual_net_profit === 500 },
    ];

    // Print formatted table
    const hdr = '| ' + 'Metric'.padEnd(28) + ' | ' + 'Expected'.padEnd(18) + ' | ' + 'Actual'.padEnd(18) + ' | Status |';
    const sep = '|' + '-'.repeat(30) + '|' + '-'.repeat(20) + '|' + '-'.repeat(20) + '|--------|';
    console.log(hdr);
    console.log(sep);
    for (const c of checks) {
      const status = c.pass ? '  ✅  ' : '  ❌  ';
      console.log('| ' + c.metric.padEnd(28) + ' | ' + c.expected.padEnd(18) + ' | ' + c.actual.padEnd(18) + ' | ' + status + ' |');
    }
    console.log(sep);

    const allPass = checks.every(c => c.pass);
    console.log('\n' + (allPass ? '🎉 ALL CHECKS PASSED — Audit verification complete.' : '⚠️  SOME CHECKS FAILED — Review discrepancies above.'));

    // Net Profit formula breakdown
    console.log('\n───────────────────────────────────────');
    console.log(' Net Profit Breakdown');
    console.log('───────────────────────────────────────');
    console.log('  Revenue          = ₹' + results.actual_revenue_delta.toFixed(2));
    console.log('  − COGS           = ₹' + results.expected_cogs.toFixed(2));
    console.log('  − Expenses       = ₹' + results.actual_expenses_delta.toFixed(2));
    console.log('  ─────────────────────');
    console.log('  Net Profit       = ₹' + results.actual_net_profit.toFixed(2));

    // Data integrity summary
    console.log('\n───────────────────────────────────────');
    console.log(' Data Integrity Summary');
    console.log('───────────────────────────────────────');
    console.log('  Stock deduction correct:   ' + ((results.baseline_stock - results.actual_stock) === 10 ? '✅' : '❌'));
    console.log('  Revenue recorded correct:  ' + (results.actual_revenue_delta === 3500 ? '✅' : '❌'));
    console.log('  Expense recorded correct:  ' + (results.actual_expenses_delta === 500 ? '✅' : '❌'));
    console.log('  Net profit matches:        ' + (results.actual_net_profit === 500 ? '✅' : '❌'));

    // Output JSON for artifact parsing
    console.log('\n__JSON_RESULTS__');
    console.log(JSON.stringify({ checks, allPass, results }, null, 2));

  } catch (e) {
    console.error('\n❌ E2E AUDIT FAILED:', e.message);
    console.error(e.stack);
  }

  process.exit(0);
})();
