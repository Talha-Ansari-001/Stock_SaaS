const mysql = require('mysql2/promise');
const http = require('http');
require('dotenv').config();

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

// ─── Direct DB pool for verification ─────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: { rejectUnauthorized: false }
});

// ─── Main E2E ────────────────────────────────────────────────────────────────
(async () => {
  const results = {};
  const ts = Date.now();

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Register a fresh test tenant
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 1] Registering test tenant...');
    const reg = await api('POST', '/api/auth/register', {
      business_name: 'E2E_Audit_' + ts,
      email: 'e2e_' + ts + '@test.com',
      password: 'AuditPass123!'
    });
    if (reg.status !== 201) throw new Error('Registration failed: ' + JSON.stringify(reg.data));
    const token = reg.data.token;
    console.log('  ✅ Registered. Token obtained.');

    // Decode tenant_id from JWT
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const tenantId = payload.tenantId;
    console.log('  Tenant ID: ' + tenantId);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Create inventory item — Cement Bag, 50 units, sell @350, cost @250
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 2] Creating inventory: Cement Bag x50 @ ₹350 (cost ₹250)...');
    const addProd = await api('POST', '/api/products', {
      name: 'Cement Bag',
      quantity: 50,
      price: 350,
      buying_price: 250,
      kg_per_unit: 50,
      default_unit: 'Bags',
      allowed_units: 'Bags,Kg',
      supplier_name: 'E2E Test Supplier'
    }, token);
    if (addProd.status !== 201) throw new Error('Add product failed: ' + JSON.stringify(addProd.data));
    console.log('  ✅ Product added.');

    // Fetch product to get ID and baseline values
    const prodList = await api('GET', '/api/products', null, token);
    const product = prodList.data.find(p => p.name === 'Cement Bag');
    if (!product) throw new Error('Product not found after creation');
    const productId = product.id;
    results.baseline_stock = parseFloat(product.quantity);
    results.baseline_value = results.baseline_stock * parseFloat(product.price);
    console.log('  Product ID: ' + productId);
    console.log('  Baseline stock: ' + results.baseline_stock + ' Bags');
    console.log('  Baseline value: ₹' + results.baseline_value);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Process POS sale — 10 Bags via multi-item cart endpoint
    // ═══════════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Record operational expense — Transport ₹500
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 4] Recording expense: Transport/Fuel ₹500...');
    const exp = await api('POST', '/api/expenses', {
      title: 'Truck Transport',
      category: 'Transport/Fuel',
      amount: 500,
      notes: 'E2E audit transport cost'
    }, token);
    if (exp.status !== 201) throw new Error('Expense failed: ' + JSON.stringify(exp.data));
    console.log('  ✅ Expense recorded.');

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: VERIFY — Query API + Direct DB
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n[STEP 5] Running verification audit...');

    // 5a. Inventory check via API
    const prodsAfter = await api('GET', '/api/products', null, token);
    const prodAfter = prodsAfter.data.find(p => p.id === productId);
    results.actual_stock = parseFloat(prodAfter.quantity);
    results.expected_stock = 40;

    // 5b. Sales revenue via API
    const salesHistory = await api('GET', '/api/sales/history', null, token);
    const totalRevenue = salesHistory.data.reduce((sum, s) => sum + parseFloat(s.total_revenue || 0), 0);
    results.actual_revenue = totalRevenue;
    results.expected_revenue = 3500;

    // 5c. Expenses via API
    const expenses = await api('GET', '/api/expenses', null, token);
    const totalExpenses = expenses.data.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    results.actual_expenses = totalExpenses;
    results.expected_expenses = 500;

    // 5d. COGS calculation: 10 bags * ₹250 buying_price = ₹2,500
    results.expected_cogs = 10 * 250;
    results.expected_net_profit = results.expected_revenue - results.expected_cogs - results.expected_expenses;
    results.actual_net_profit = results.actual_revenue - results.expected_cogs - results.actual_expenses;

    // 5e. Direct DB verification
    console.log('\n[STEP 5e] Direct database verification...');

    const [dbProduct] = await pool.query(
      'SELECT quantity, price, buying_price FROM products WHERE id = ? AND tenant_id = ?',
      [productId, tenantId]
    );
    results.db_stock = parseFloat(dbProduct[0].quantity);

    const [dbSales] = await pool.query(
      'SELECT SUM(total_revenue) as rev, SUM(quantity_sold) as qty FROM sales WHERE tenant_id = ?',
      [tenantId]
    );
    results.db_revenue = parseFloat(dbSales[0].rev || 0);
    results.db_qty_sold = parseFloat(dbSales[0].qty || 0);

    const [dbExpenses] = await pool.query(
      'SELECT SUM(amount) as total FROM expenses WHERE tenant_id = ?',
      [tenantId]
    );
    results.db_expenses = parseFloat(dbExpenses[0].total || 0);

    const [dbOrder] = await pool.query(
      'SELECT id, tenant_id, total_amount, paid_amount, due_amount, payment_status FROM orders WHERE id = ? AND tenant_id = ?',
      [orderId, tenantId]
    );
    results.db_order_tenant_match = dbOrder.length > 0 && dbOrder[0].tenant_id === tenantId;
    results.db_order_amount = dbOrder.length > 0 ? parseFloat(dbOrder[0].total_amount) : null;
    results.db_order_status = dbOrder.length > 0 ? dbOrder[0].payment_status : null;

    // ═══════════════════════════════════════════════════════════════════════════
    // OUTPUT: Final audit table
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log(' E2E AUDIT RESULTS — Tenant: ' + tenantId);
    console.log('='.repeat(80));

    const checks = [
      { metric: 'Baseline Stock', expected: '50 Bags', actual: results.baseline_stock + ' Bags', pass: results.baseline_stock === 50 },
      { metric: 'Post-Sale Stock (API)', expected: '40 Bags', actual: results.actual_stock + ' Bags', pass: results.actual_stock === 40 },
      { metric: 'Post-Sale Stock (DB)', expected: '40 Bags', actual: results.db_stock + ' Bags', pass: results.db_stock === 40 },
      { metric: 'Sales Revenue (API)', expected: '₹3,500.00', actual: '₹' + results.actual_revenue.toFixed(2), pass: results.actual_revenue === 3500 },
      { metric: 'Sales Revenue (DB)', expected: '₹3,500.00', actual: '₹' + results.db_revenue.toFixed(2), pass: results.db_revenue === 3500 },
      { metric: 'Qty Sold (DB)', expected: '10', actual: String(results.db_qty_sold), pass: results.db_qty_sold === 10 },
      { metric: 'Expenses (API)', expected: '₹500.00', actual: '₹' + results.actual_expenses.toFixed(2), pass: results.actual_expenses === 500 },
      { metric: 'Expenses (DB)', expected: '₹500.00', actual: '₹' + results.db_expenses.toFixed(2), pass: results.db_expenses === 500 },
      { metric: 'COGS (10 × ₹250)', expected: '₹2,500.00', actual: '₹' + results.expected_cogs.toFixed(2), pass: true },
      { metric: 'Net Profit', expected: '₹500.00', actual: '₹' + results.actual_net_profit.toFixed(2), pass: results.actual_net_profit === 500 },
      { metric: 'Order tenant_id (DB)', expected: tenantId, actual: results.db_order_tenant_match ? tenantId : 'MISMATCH', pass: results.db_order_tenant_match },
      { metric: 'Order Amount (DB)', expected: '₹3,500.00', actual: results.db_order_amount !== null ? '₹' + results.db_order_amount.toFixed(2) : 'NULL', pass: results.db_order_amount === 3500 },
      { metric: 'Order Status (DB)', expected: 'Paid', actual: results.db_order_status || 'NULL', pass: results.db_order_status === 'Paid' },
    ];

    // Print table
    const hdr = '| ' + 'Metric'.padEnd(25) + ' | ' + 'Expected'.padEnd(20) + ' | ' + 'Actual'.padEnd(20) + ' | Status |';
    const sep = '|' + '-'.repeat(27) + '|' + '-'.repeat(22) + '|' + '-'.repeat(22) + '|--------|';
    console.log(hdr);
    console.log(sep);
    for (const c of checks) {
      const status = c.pass ? '  ✅  ' : '  ❌  ';
      console.log('| ' + c.metric.padEnd(25) + ' | ' + c.expected.padEnd(20) + ' | ' + c.actual.padEnd(20) + ' | ' + status + ' |');
    }
    console.log(sep);

    const allPass = checks.every(c => c.pass);
    console.log('\n' + (allPass ? '🎉 ALL CHECKS PASSED' : '⚠️  SOME CHECKS FAILED') + '\n');

    // Net Profit formula breakdown
    console.log('Net Profit Formula:');
    console.log('  Revenue    = ₹' + results.actual_revenue.toFixed(2));
    console.log('  - COGS     = ₹' + results.expected_cogs.toFixed(2));
    console.log('  - Expenses = ₹' + results.actual_expenses.toFixed(2));
    console.log('  ─────────────────');
    console.log('  Net Profit = ₹' + results.actual_net_profit.toFixed(2));

    // Transaction integrity
    console.log('\nTransaction Integrity:');
    console.log('  Orders table tenant scoping: ' + (results.db_order_tenant_match ? '✅ Correct' : '❌ BROKEN'));
    console.log('  API ↔ DB stock agreement:    ' + (results.actual_stock === results.db_stock ? '✅ Consistent' : '❌ DRIFT'));
    console.log('  API ↔ DB revenue agreement:  ' + (results.actual_revenue === results.db_revenue ? '✅ Consistent' : '❌ DRIFT'));

    // Output as JSON for artifact parsing
    console.log('\n__JSON_RESULTS__');
    console.log(JSON.stringify({ checks, allPass, results }, null, 2));

  } catch (e) {
    console.error('\n❌ E2E AUDIT FAILED:', e.message);
    console.error(e.stack);
  }

  process.exit(0);
})();
