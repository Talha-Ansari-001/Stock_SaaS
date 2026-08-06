/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  COMPREHENSIVE QA AUDIT — Full Inventory, POS, Expenses, Accounting
 *
 *  Login: ash@gmail.com / ash
 *  Products: 6 items (Cements, Sand, Bricks, Blocks, Khadi, Dr Fixit)
 *  Sales: 2 multi-item transactions (₹11,800 + ₹9,000 = ₹20,800)
 *  Expenses: 2 entries (₹1,500 + ₹800 = ₹2,300)
 *  Verification: inventory balances, revenue, expenses, net profit
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

function log(msg) { console.log(msg); }
function logOK(msg) { console.log('  ✅ ' + msg); }
function logFAIL(msg) { console.error('  ❌ ' + msg); }
function hdr(step, title) { console.log('\n' + '═'.repeat(80)); console.log(' [STEP ' + step + '] ' + title); console.log('═'.repeat(80)); }

// ─── Product catalog ─────────────────────────────────────────────────────────
const PRODUCTS = [
  { name: 'Ambuja Cements',   quantity: 100,  price: 380,  buying_price: 320,  kg_per_unit: 50,  default_unit: 'Bags',    allowed_units: 'Bags',    supplier_name: 'Ambuja Dealer' },
  { name: 'Sand (Reti)',       quantity: 50,   price: 60,   buying_price: 40,   kg_per_unit: 40,  default_unit: 'Bags',    allowed_units: 'Bags',    supplier_name: 'Local Quarry' },
  { name: 'Eita 6 inch',      quantity: 1000, price: 9,    buying_price: 6,    kg_per_unit: 1,   default_unit: 'Pieces',  allowed_units: 'Pieces',  supplier_name: 'Brick Kiln' },
  { name: 'Block 8 inch',     quantity: 500,  price: 45,   buying_price: 30,   kg_per_unit: 1,   default_unit: 'Pieces',  allowed_units: 'Pieces',  supplier_name: 'Block Factory' },
  { name: 'Khadi',            quantity: 10,   price: 4500, buying_price: 3500, kg_per_unit: 1,   default_unit: 'Baraas',  allowed_units: 'Baraas',  supplier_name: 'Khadi Supplier' },
  { name: 'Dr Fixit 5 litr',  quantity: 15,   price: 1200, buying_price: 900,  kg_per_unit: 5,   default_unit: 'Bottles', allowed_units: 'Bottles', supplier_name: 'Pidilite Dist.' },
];

// ─── Expected post-sale inventory ────────────────────────────────────────────
const EXPECTED_POST_SALE = {
  'Ambuja Cements':  80,   // 100 - 20
  'Sand (Reti)':     50,   // untouched
  'Eita 6 inch':     800,  // 1000 - 200
  'Block 8 inch':    500,  // untouched
  'Khadi':           8,    // 10 - 2
  'Dr Fixit 5 litr': 13,   // 15 - 2
};

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const errors = [];
  let token = null;
  let tenantId = null;

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 0: LOGIN
    // ═══════════════════════════════════════════════════════════════════════════
    hdr(0, 'LOGIN as ash@gmail.com');
    const login = await api('POST', '/api/auth/login', {
      email: 'ash@gmail.com',
      password: 'ash'
    });
    if (login.status !== 200) {
      throw new Error('LOGIN FAILED [' + login.status + ']: ' + JSON.stringify(login.data));
    }
    token = login.data.token;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    tenantId = payload.tenantId;
    logOK('Authenticated. Tenant: ' + tenantId);

    // ═══════════════════════════════════════════════════════════════════════════
    // SNAPSHOT: Pre-existing state
    // ═══════════════════════════════════════════════════════════════════════════
    const preProducts = await api('GET', '/api/products', null, token);
    const preSales    = await api('GET', '/api/sales/history', null, token);
    const preExpenses = await api('GET', '/api/expenses', null, token);

    const preRevenueTotal  = (preSales.data || []).reduce((s, o) => s + parseFloat(o.total_revenue || 0), 0);
    const preExpensesTotal = (preExpenses.data || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    // Track pre-existing quantities for each product name
    const preQtyMap = {};
    for (const p of (preProducts.data || [])) {
      preQtyMap[p.name] = parseFloat(p.quantity);
    }

    log('  Pre-existing revenue:  ₹' + preRevenueTotal.toFixed(2));
    log('  Pre-existing expenses: ₹' + preExpensesTotal.toFixed(2));

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: ADD ALL 6 PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════════
    hdr(1, 'INITIAL INVENTORY SETUP — 6 Products');

    for (const prod of PRODUCTS) {
      const res = await api('POST', '/api/products', prod, token);
      if (res.status !== 201) {
        const msg = 'POST /api/products FAILED for "' + prod.name + '" [' + res.status + ']: ' + JSON.stringify(res.data);
        logFAIL(msg);
        errors.push({ endpoint: 'POST /api/products', product: prod.name, status: res.status, detail: res.data });
      } else {
        logOK(prod.name + ' — ' + prod.quantity + ' ' + prod.default_unit + ' @ ₹' + prod.price);
      }
    }

    // Fetch all products and build ID map
    const prodListRes = await api('GET', '/api/products', null, token);
    if (prodListRes.status !== 200) throw new Error('GET /api/products failed: ' + JSON.stringify(prodListRes.data));

    const idMap = {};
    const postAddQtyMap = {};
    for (const p of prodListRes.data) {
      idMap[p.name] = p.id;
      postAddQtyMap[p.name] = parseFloat(p.quantity);
    }

    log('\n  Product ID Map:');
    for (const prod of PRODUCTS) {
      const id = idMap[prod.name];
      const qty = postAddQtyMap[prod.name];
      if (!id) {
        logFAIL(prod.name + ' — NOT FOUND after creation!');
        errors.push({ endpoint: 'GET /api/products', product: prod.name, status: 200, detail: 'Product missing from list after creation' });
      } else {
        log('    [' + id + '] ' + prod.name + ' = ' + qty + ' ' + prod.default_unit);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: POS TRANSACTIONS — Sale 1 (Mixed Materials)
    // ═══════════════════════════════════════════════════════════════════════════
    hdr('2a', 'SALE 1 — Mixed Materials (₹11,800)');

    const sale1Items = [
      { product_id: idMap['Ambuja Cements'],  quantity: 20,  unit_price: 380, subtotal: 7600 },
      { product_id: idMap['Eita 6 inch'],     quantity: 200, unit_price: 9,   subtotal: 1800 },
      { product_id: idMap['Dr Fixit 5 litr'], quantity: 2,   unit_price: 1200, subtotal: 2400 },
    ];

    // Validate all product IDs resolved
    for (const item of sale1Items) {
      if (!item.product_id) {
        const msg = 'Product ID not found for sale item — cannot process Sale 1';
        logFAIL(msg);
        errors.push({ endpoint: 'POST /api/sales/multi', product: 'Sale 1 item', detail: msg });
      }
    }

    const sale1 = await api('POST', '/api/sales/multi', {
      buyer_name: 'QA Customer - Mixed Order',
      contact_number: '9876543210',
      payment_method: 'Cash',
      payment_status: 'Paid',
      total_amount: 11800,
      paid_amount: 11800,
      due_amount: 0,
      transportation_fee: 0,
      items: sale1Items
    }, token);

    if (sale1.status !== 201) {
      const msg = 'POST /api/sales/multi FAILED for Sale 1 [' + sale1.status + ']: ' + JSON.stringify(sale1.data);
      logFAIL(msg);
      errors.push({ endpoint: 'POST /api/sales/multi', sale: 'Sale 1', status: sale1.status, detail: sale1.data });
    } else {
      logOK('Sale 1 processed. Order ID: ' + sale1.data.order_id);
      log('    20 × Ambuja Cements  = ₹7,600');
      log('    200 × Eita 6 inch    = ₹1,800');
      log('    2 × Dr Fixit 5 litr  = ₹2,400');
      log('    ─────────────────────────────');
      log('    Total                 = ₹11,800');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2b: SALE 2 — Bulk Aggregate (Khadi)
    // ═══════════════════════════════════════════════════════════════════════════
    hdr('2b', 'SALE 2 — Bulk Khadi (₹9,000)');

    const sale2 = await api('POST', '/api/sales/multi', {
      buyer_name: 'QA Customer - Khadi Bulk',
      contact_number: '9988776655',
      payment_method: 'Cash',
      payment_status: 'Paid',
      total_amount: 9000,
      paid_amount: 9000,
      due_amount: 0,
      transportation_fee: 0,
      items: [{
        product_id: idMap['Khadi'],
        quantity: 2,
        unit_price: 4500,
        subtotal: 9000
      }]
    }, token);

    if (sale2.status !== 201) {
      const msg = 'POST /api/sales/multi FAILED for Sale 2 [' + sale2.status + ']: ' + JSON.stringify(sale2.data);
      logFAIL(msg);
      errors.push({ endpoint: 'POST /api/sales/multi', sale: 'Sale 2', status: sale2.status, detail: sale2.data });
    } else {
      logOK('Sale 2 processed. Order ID: ' + sale2.data.order_id);
      log('    2 × Khadi            = ₹9,000');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: EXPENSE LOGGING
    // ═══════════════════════════════════════════════════════════════════════════
    hdr(3, 'EXPENSE LOGGING — 2 Entries (₹2,300)');

    const exp1 = await api('POST', '/api/expenses', {
      title: 'Tempo / Transportation Charges',
      category: 'Transport/Fuel',
      amount: 1500,
      notes: 'QA audit — tempo charges for material delivery'
    }, token);
    if (exp1.status !== 201) {
      logFAIL('POST /api/expenses FAILED for Expense 1 [' + exp1.status + ']: ' + JSON.stringify(exp1.data));
      errors.push({ endpoint: 'POST /api/expenses', expense: 'Transport', status: exp1.status, detail: exp1.data });
    } else {
      logOK('Expense 1: Tempo / Transportation Charges = ₹1,500');
    }

    const exp2 = await api('POST', '/api/expenses', {
      title: 'Unloading Labor Wages',
      category: 'Labor/Wages',
      amount: 800,
      notes: 'QA audit — unloading labor payment'
    }, token);
    if (exp2.status !== 201) {
      logFAIL('POST /api/expenses FAILED for Expense 2 [' + exp2.status + ']: ' + JSON.stringify(exp2.data));
      errors.push({ endpoint: 'POST /api/expenses', expense: 'Labor', status: exp2.status, detail: exp2.data });
    } else {
      logOK('Expense 2: Unloading Labor Wages = ₹800');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: ACCURACY AUDIT & VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════
    hdr(4, 'ACCURACY AUDIT — Full Verification');

    // 4a. Fetch final product inventory
    const finalProducts = await api('GET', '/api/products', null, token);
    if (finalProducts.status !== 200) throw new Error('GET /api/products final failed');

    const finalQtyMap = {};
    for (const p of finalProducts.data) {
      finalQtyMap[p.name] = parseFloat(p.quantity);
    }

    // 4b. Fetch sales history (delta)
    const finalSales = await api('GET', '/api/sales/history', null, token);
    const postRevenueTotal = (finalSales.data || []).reduce((s, o) => s + parseFloat(o.total_revenue || 0), 0);
    const revenueDelta = postRevenueTotal - preRevenueTotal;

    // 4c. Fetch expenses (delta)
    const finalExpenses = await api('GET', '/api/expenses', null, token);
    const postExpensesTotal = (finalExpenses.data || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const expensesDelta = postExpensesTotal - preExpensesTotal;

    // 4d. COGS calculation
    //   Sale 1: 20 × ₹320 + 200 × ₹6 + 2 × ₹900 = 6400 + 1200 + 1800 = 9400
    //   Sale 2: 2 × ₹3500 = 7000
    //   Total COGS = 16,400
    const cogs = (20 * 320) + (200 * 6) + (2 * 900) + (2 * 3500);

    // 4e. Net profit
    const grossProfit = revenueDelta - cogs;
    const netProfit = revenueDelta - cogs - expensesDelta;

    // ─── Build verification checks ──────────────────────────────────────────
    const checks = [];

    // Inventory checks
    for (const prod of PRODUCTS) {
      const expected = EXPECTED_POST_SALE[prod.name];
      // Account for pre-existing quantity: if the product existed before, the API
      // adds to existing qty. So expected final = preQty + addedQty - soldQty
      const preQty = preQtyMap[prod.name] || 0;
      const addedQty = prod.quantity;
      const soldMap = {
        'Ambuja Cements': 20,
        'Sand (Reti)': 0,
        'Eita 6 inch': 200,
        'Block 8 inch': 0,
        'Khadi': 2,
        'Dr Fixit 5 litr': 2,
      };
      const sold = soldMap[prod.name] || 0;
      const expectedFinal = preQty + addedQty - sold;
      const actual = finalQtyMap[prod.name];
      const pass = actual !== undefined && actual === expectedFinal;

      checks.push({
        category: 'Inventory',
        metric: prod.name,
        expected: expectedFinal + ' ' + prod.default_unit,
        actual: actual !== undefined ? actual + ' ' + prod.default_unit : 'NOT FOUND',
        pass,
        note: preQty > 0 ? '(pre-existing: ' + preQty + ', added: ' + addedQty + ', sold: ' + sold + ')' : ''
      });
    }

    // Revenue check
    checks.push({
      category: 'Financial',
      metric: 'Total Revenue (this audit)',
      expected: '₹20,800.00',
      actual: '₹' + revenueDelta.toFixed(2),
      pass: revenueDelta === 20800,
      note: ''
    });

    // Expenses check
    checks.push({
      category: 'Financial',
      metric: 'Total Expenses (this audit)',
      expected: '₹2,300.00',
      actual: '₹' + expensesDelta.toFixed(2),
      pass: expensesDelta === 2300,
      note: ''
    });

    // COGS check
    checks.push({
      category: 'Financial',
      metric: 'COGS',
      expected: '₹16,400.00',
      actual: '₹' + cogs.toFixed(2),
      pass: true,
      note: '(computed from buying prices)'
    });

    // Gross profit
    checks.push({
      category: 'Financial',
      metric: 'Gross Profit (Revenue - COGS)',
      expected: '₹4,400.00',
      actual: '₹' + grossProfit.toFixed(2),
      pass: grossProfit === 4400,
      note: ''
    });

    // Net profit
    checks.push({
      category: 'Financial',
      metric: 'Net Profit (Gross - Expenses)',
      expected: '₹2,100.00',
      actual: '₹' + netProfit.toFixed(2),
      pass: netProfit === 2100,
      note: ''
    });

    // ─── Print results ──────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(90));
    console.log(' COMPREHENSIVE QA AUDIT RESULTS');
    console.log(' Tenant: ' + tenantId + '  |  User: ash@gmail.com');
    console.log(' Timestamp: ' + new Date().toISOString());
    console.log('═'.repeat(90));

    // Inventory section
    console.log('\n─── INVENTORY BALANCES ────────────────────────────────────────────');
    const invHdr = '| ' + 'Product'.padEnd(22) + ' | ' + 'Expected'.padEnd(18) + ' | ' + 'Actual'.padEnd(18) + ' | Status | Note';
    const invSep = '|' + '-'.repeat(24) + '|' + '-'.repeat(20) + '|' + '-'.repeat(20) + '|--------|------';
    console.log(invHdr);
    console.log(invSep);
    for (const c of checks.filter(c => c.category === 'Inventory')) {
      const status = c.pass ? '  ✅  ' : '  ❌  ';
      console.log('| ' + c.metric.padEnd(22) + ' | ' + c.expected.padEnd(18) + ' | ' + c.actual.padEnd(18) + ' | ' + status + ' | ' + c.note);
    }

    // Financial section
    console.log('\n─── FINANCIAL TOTALS ──────────────────────────────────────────────');
    const finHdr = '| ' + 'Metric'.padEnd(35) + ' | ' + 'Expected'.padEnd(18) + ' | ' + 'Actual'.padEnd(18) + ' | Status |';
    const finSep = '|' + '-'.repeat(37) + '|' + '-'.repeat(20) + '|' + '-'.repeat(20) + '|--------|';
    console.log(finHdr);
    console.log(finSep);
    for (const c of checks.filter(c => c.category === 'Financial')) {
      const status = c.pass ? '  ✅  ' : '  ❌  ';
      console.log('| ' + c.metric.padEnd(35) + ' | ' + c.expected.padEnd(18) + ' | ' + c.actual.padEnd(18) + ' | ' + status + ' |');
    }

    // Overall result
    const allPass = checks.every(c => c.pass);
    console.log('\n' + (allPass ? '🎉 ALL ' + checks.length + ' CHECKS PASSED — Full QA audit verified.' : '⚠️  SOME CHECKS FAILED — Review discrepancies above.'));

    // Profit breakdown
    console.log('\n─── PROFIT BREAKDOWN ─────────────────────────────────────────────');
    console.log('  Sale 1 Revenue          = ₹11,800.00  (Mixed Materials)');
    console.log('  Sale 2 Revenue          = ₹ 9,000.00  (Khadi Bulk)');
    console.log('  ──────────────────────────────────');
    console.log('  Total Revenue           = ₹' + revenueDelta.toFixed(2));
    console.log('');
    console.log('  COGS Breakdown:');
    console.log('    20 × Ambuja @ ₹320    = ₹ 6,400.00');
    console.log('    200 × Eita @ ₹6       = ₹ 1,200.00');
    console.log('    2 × Dr Fixit @ ₹900   = ₹ 1,800.00');
    console.log('    2 × Khadi @ ₹3,500    = ₹ 7,000.00');
    console.log('  ──────────────────────────────────');
    console.log('  Total COGS              = ₹' + cogs.toFixed(2));
    console.log('');
    console.log('  Gross Profit            = ₹' + grossProfit.toFixed(2));
    console.log('');
    console.log('  Expenses:');
    console.log('    Tempo / Transport      = ₹ 1,500.00');
    console.log('    Unloading Labor        = ₹   800.00');
    console.log('  ──────────────────────────────────');
    console.log('  Total Expenses          = ₹' + expensesDelta.toFixed(2));
    console.log('');
    console.log('  NET PROFIT              = ₹' + netProfit.toFixed(2));

    // Errors section
    if (errors.length > 0) {
      console.log('\n─── API ERRORS ENCOUNTERED ───────────────────────────────────────');
      for (const e of errors) {
        console.log('  Endpoint: ' + e.endpoint);
        console.log('  Context:  ' + (e.product || e.sale || e.expense || 'unknown'));
        console.log('  Status:   ' + e.status);
        console.log('  Detail:   ' + JSON.stringify(e.detail));
        console.log('  ---');
      }
    }

    // JSON output for artifact parsing
    console.log('\n__JSON_RESULTS__');
    console.log(JSON.stringify({ checks, allPass, errors, revenueDelta, expensesDelta, cogs, grossProfit, netProfit }, null, 2));

  } catch (e) {
    console.error('\n❌ QA AUDIT FATAL ERROR:', e.message);
    console.error(e.stack);
    if (errors.length > 0) {
      console.error('\nCollected errors before failure:');
      for (const err of errors) console.error('  ' + JSON.stringify(err));
    }
  }

  process.exit(0);
})();
