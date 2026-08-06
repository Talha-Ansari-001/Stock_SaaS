const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // ⚡ Secure cryptographic hashing

// Load environmental variables in development if you are using dotenv
require('dotenv').config(); 

const app = express();
app.use(express.json());

const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'] 
  : '*';

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const JWT_SECRET = process.env.JWT_SECRET || 'TRADER_OS_SECRET_KEY';

// 🌐 CONNECTING TO YOUR ONLINE AIVEN DATABASE WITH REQUIRED SSL
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'defaultdb',
  connectionLimit: 10,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false // Required for managed cloud providers like Aiven
  } : false
});

// Cleanly handle database pool disconnects or SSL handshake rejections without crashing the server
if (typeof pool.on === 'function') {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    } else if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    }
  });
} else if (pool.pool && typeof pool.pool.on === 'function') {
  pool.pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
  });
}

// ─────────────────────────────────────────────
// UNPROTECTED ROUTES: LOGIN / REGISTER (No Token Needed)
// ─────────────────────────────────────────────

/**
 * 🔑 REGISTER NEW BUSINESS
 */
app.post('/api/auth/register', async (req, res) => {
  const { business_name, email, password } = req.body;

  if (!business_name || !email || !password) {
    return res.status(400).json({ error: "Business name, Email, and Password are required" });
  }

  try {
    const tenantId = 'tenant_' + Math.random().toString(36).substr(2, 9);

    // ⚡ Securely hash the password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.execute(
      'INSERT INTO tenants (id, business_name, email, password) VALUES (?, ?, ?, ?)',
      [tenantId, business_name, email, hashedPassword]
    );

    const token = jwt.sign({ tenantId }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, message: "Welcome to Trader Workspace" });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "This email or business name is already registered." });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔓 LOGIN EXISTING BUSINESS
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email address and Password are required" });
  }

  try {
    let [rows] = await pool.execute('SELECT id, password FROM tenants WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "No account found with this email address." });
    }

    const tenant = rows[0];

    const isPasswordValid = await bcrypt.compare(password, tenant.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password credentials. Terminal access denied." });
    }

    const token = jwt.sign({ tenantId: tenant.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, message: "Welcome to Trader Workspace" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// JWT SECURITY MIDDLEWARE BOUNDARY
// ─────────────────────────────────────────────
const authenticateTenant = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access Denied: Missing Session Token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Session Expired or Invalid" });
    req.tenant_id = decoded.tenantId;
    next();
  });
};

app.use('/api', authenticateTenant);

// ─────────────────────────────────────────────
// PROTECTED TRADER ROUTES (Token Enforcement Active)
// ─────────────────────────────────────────────

// INVENTORY: Get all products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products WHERE tenant_id = ?', [req.tenant_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INVENTORY: Add new product / replenish quantity
app.post('/api/products', async (req, res) => {
  const { name, quantity, price, buying_price, kg_per_unit, default_unit, allowed_units, supplier_name } = req.body;

  if (!name || quantity === undefined || price === undefined || buying_price === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const parsedQty = parseFloat(quantity);
  if (isNaN(parsedQty)) {
    return res.status(400).json({ error: "Quantity must be a valid number." });
  }

  const safeKgPerUnit = parseFloat(kg_per_unit) && parseFloat(kg_per_unit) > 0 ? parseFloat(kg_per_unit) : 1.00;
  const safeDefaultUnit = default_unit || 'Piece';
  const safeAllowedUnits = allowed_units || 'Piece';

  try {
    const [existing] = await pool.execute('SELECT id FROM products WHERE name = ? AND tenant_id = ?', [name, req.tenant_id]);
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE products SET quantity = quantity + ?, price = ?, buying_price = ?, kg_per_unit = ?, default_unit = ?, allowed_units = ?, supplier_name = ? WHERE id = ? AND tenant_id = ?',
        [parsedQty, Number(price), Number(buying_price), safeKgPerUnit, safeDefaultUnit, safeAllowedUnits, supplier_name || null, existing[0].id, req.tenant_id]
      );
    } else {
      await pool.execute(
        'INSERT INTO products (tenant_id, name, quantity, price, buying_price, kg_per_unit, default_unit, allowed_units, supplier_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.tenant_id, name, parsedQty, Number(price), Number(buying_price), safeKgPerUnit, safeDefaultUnit, safeAllowedUnits, supplier_name || null]
      );
    }
    res.status(201).json({ success: true, message: "Inventory updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES: Register a sell entry & automatically deduct quantity safely
app.post('/api/sales', async (req, res) => {
  const { product_id, quantity_to_sell, quantity_unit, payment_method, buyer_name, buyer_contact, amount_paid } = req.body;

  if (!product_id || !quantity_to_sell) {
    return res.status(400).json({ error: "Product identifier and Quantity are required variables." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [products] = await connection.execute(
      'SELECT id, quantity, price, kg_per_unit FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [product_id, req.tenant_id]
    );

    if (products.length === 0) throw new Error("Item not found in your inventory catalog");
    const product = products[0];

    const inputQty = parseFloat(quantity_to_sell);
    const kgPerUnit = parseFloat(product.kg_per_unit) || 1.00;

    let unitsToDeduct = 0;
    let total_revenue = 0;

    if (quantity_unit === 'Kg') {
      unitsToDeduct = inputQty / kgPerUnit;
      total_revenue = (parseFloat(product.price) / kgPerUnit) * inputQty;
    } else {
      unitsToDeduct = inputQty;
      total_revenue = parseFloat(product.price) * inputQty;
    }

    if (parseFloat(product.quantity) < unitsToDeduct) {
      const availableKg = (parseFloat(product.quantity) * kgPerUnit).toFixed(2);
      throw new Error(`Insufficient Stock level! Only ${parseFloat(product.quantity).toFixed(2)} units (${availableKg} Kg) left.`);
    }

    await connection.execute(
      'UPDATE products SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?',
      [unitsToDeduct, product_id, req.tenant_id]
    );

    const finalAmountPaid = amount_paid !== undefined && amount_paid !== null ? parseFloat(amount_paid) : total_revenue;
    const dueAmount = Math.max(0, total_revenue - finalAmountPaid);
    let paymentStatus = 'Paid';
    if (dueAmount > 0 && finalAmountPaid > 0) paymentStatus = 'Partial';
    else if (finalAmountPaid <= 0) paymentStatus = 'Unpaid';

    const [orderResult] = await connection.execute(
      'INSERT INTO orders (tenant_id, buyer_name, contact_number, payment_method, payment_status, total_amount, paid_amount, due_amount, transportation_fee, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())',
      [req.tenant_id, buyer_name || 'Walk-in Customer', buyer_contact || 'N/A', payment_method || 'Cash', paymentStatus, total_revenue, finalAmountPaid, dueAmount]
    );

    const orderId = orderResult.insertId;

    await connection.execute(
      'INSERT INTO sales (tenant_id, order_id, product_id, quantity_sold, total_revenue, paid_amount, due_amount, buyer_name, buyer_contact, quantity_unit, payment_method, payment_status, sold_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [req.tenant_id, orderId, product_id, inputQty, total_revenue, finalAmountPaid, dueAmount, buyer_name || null, buyer_contact || null, quantity_unit || 'Piece', payment_method || 'Cash', paymentStatus]
    );

    await connection.commit();
    res.json({ success: true, message: "Sale processed. Stock level deducted." });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────
// 🛒 MULTI-ITEM CART: Point-of-Sale Transaction Engine
// ─────────────────────────────────────────────

/**
 * POST /api/sales/multi
 * Processes a full cart checkout as a single atomic database transaction.
 */
app.post('/api/sales/multi', async (req, res) => {
  const { buyer_name, contact_number, payment_method, payment_status, total_amount, transportation_fee, items } = req.body;
  const transportFee = Number(transportation_fee) || 0;
  const safePaymentStatus = payment_status || 'Paid';

  // ── Input validation ───────────────────────────────────────────────────────
  if (!buyer_name || typeof buyer_name !== 'string' || buyer_name.trim() === '') {
    return res.status(400).json({ error: "buyer_name is required and must be a non-empty string." });
  }
  if (!contact_number || typeof contact_number !== 'string' || contact_number.trim() === '') {
    return res.status(400).json({ error: "contact_number is required and must be a non-empty string." });
  }
  if (!payment_method || !['Cash', 'Online', 'Credit / Unpaid', 'Credit', 'Unpaid'].includes(payment_method)) {
    return res.status(400).json({ error: "payment_method must be 'Cash', 'Online', or 'Credit / Unpaid'." });
  }
  if (total_amount === undefined || isNaN(Number(total_amount)) || Number(total_amount) < 0) {
    return res.status(400).json({ error: "total_amount must be a valid non-negative number." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array of cart line items." });
  }

  // Validate each cart line item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.product_id || isNaN(Number(item.product_id))) {
      return res.status(400).json({ error: `items[${i}].product_id is missing or invalid.` });
    }
    if (item.quantity === undefined || isNaN(parseFloat(item.quantity)) || parseFloat(item.quantity) <= 0) {
      return res.status(400).json({ error: `items[${i}].quantity must be a positive number.` });
    }
    if (item.unit_price === undefined || isNaN(Number(item.unit_price)) || Number(item.unit_price) < 0) {
      return res.status(400).json({ error: `items[${i}].unit_price must be a valid non-negative number.` });
    }
    if (item.subtotal === undefined || isNaN(Number(item.subtotal)) || Number(item.subtotal) < 0) {
      return res.status(400).json({ error: `items[${i}].subtotal must be a valid non-negative number.` });
    }
  }

  const connection = await pool.getConnection();

  try {
    // ── Step 3: Begin atomic transaction ──────────────────────────────────────
    await connection.beginTransaction();

    // ── Step 4: Insert master order record ────────────────────────────────────
    const paidAmount = req.body.paid_amount !== undefined ? Number(req.body.paid_amount) : Number(total_amount);
    const dueAmount = req.body.due_amount !== undefined ? Number(req.body.due_amount) : 0;

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (tenant_id, buyer_name, contact_number, payment_method, payment_status, total_amount, transportation_fee, paid_amount, due_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [req.tenant_id, buyer_name.trim(), contact_number.trim(), payment_method, safePaymentStatus, Number(total_amount), transportFee, paidAmount, dueAmount]
    );

    const order_id = orderResult.insertId;

    // ── Step 5: Process each cart line item ───────────────────────────────────
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId  = Number(item.product_id);
      const qty        = parseFloat(item.quantity);
      const unitPrice  = Number(item.unit_price);
      const subtotal   = Number(item.subtotal);
      
      const itemTransportFee = i === 0 ? transportFee : 0; // Attach to the first item for ledger visibility

      // Proportional calculation for item paid and due amounts
      const itemRatio = Number(total_amount) > 0 ? (subtotal / Number(total_amount)) : 0;
      const itemPaidAmt = paidAmount * itemRatio;
      const itemDueAmt = subtotal - itemPaidAmt;

      // 5a. Deduct stock — the WHERE guard prevents overselling
      const [stockResult] = await connection.execute(
        `UPDATE products
            SET quantity = quantity - ?
          WHERE id = ?
            AND tenant_id = ?
            AND quantity >= ?`,
        [qty, productId, req.tenant_id, qty]
      );

      if (stockResult.affectedRows === 0) {
        // Either product not found for this tenant, or insufficient stock
        const [productRows] = await connection.execute(
          'SELECT name, quantity FROM products WHERE id = ? AND tenant_id = ?',
          [productId, req.tenant_id]
        );
        if (productRows.length === 0) {
          throw new Error(`Product ID ${productId} was not found in your inventory.`);
        }
        const p = productRows[0];
        throw new Error(
          `Insufficient stock for "${p.name}". ` +
          `Requested: ${qty}, Available: ${parseFloat(p.quantity).toFixed(2)}.`
        );
      }

      // 5b. Insert individual sale row linked to the order
      await connection.execute(
        `INSERT INTO sales
           (tenant_id, order_id, product_id, quantity_sold, total_revenue, payment_method, payment_status, transportation_fee, paid_amount, due_amount, sold_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [req.tenant_id, order_id, productId, qty, subtotal, payment_method, safePaymentStatus, itemTransportFee, itemPaidAmt, itemDueAmt]
      );
    }

    // ── Step 7: Commit on full success ────────────────────────────────────────
    await connection.commit();
    res.status(201).json({ success: true, order_id });

  } catch (err) {
    // ── Step 6: Rollback on any failure ──────────────────────────────────────
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// REPORTS: View sales ledger history with timestamp details
app.get('/api/sales/history', async (req, res) => {
  try {
    const query = `
      SELECT 
        o.id AS id,
        o.buyer_name,
        o.contact_number AS buyer_contact,
        o.payment_method,
        o.payment_status,
        o.total_amount AS total_revenue,
        o.transportation_fee,
        o.created_at AS sold_at,
        o.paid_amount AS paid_amount,
        o.due_amount AS due_amount,
        SUM(s.quantity_returned) AS quantity_returned,
        SUM(s.amount_refunded) AS amount_refunded,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'product_id', p.id,
            'product_name', p.name,
            'quantity_sold', s.quantity_sold,
            'quantity_unit', s.quantity_unit,
            'total_revenue', s.total_revenue,
            'quantity_returned', s.quantity_returned,
            'amount_refunded', s.amount_refunded,
            'sale_id', s.id
          )
        ) AS items
      FROM orders o
      LEFT JOIN sales s ON o.id = s.order_id AND s.tenant_id = o.tenant_id
      LEFT JOIN products p ON s.product_id = p.id AND p.tenant_id = o.tenant_id
      WHERE o.tenant_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `;
    const [rows] = await pool.execute(query, [req.tenant_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INVENTORY: Delete specific item row cleanly
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM products WHERE id = ? AND tenant_id = ?', [id, req.tenant_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Item row manifest not found" });
    res.json({ success: true, message: "Inventory record permanently purged." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES: Clear outstanding debt balance / record payments
// SALES: Clear outstanding debt balance / record payments
const settleBalanceHandler = async (req, res) => {
  const { id } = req.params;
  const paymentAmountInput = req.body.amount !== undefined ? req.body.amount : req.body.payment_amount;
  const paymentMethodInput = req.body.payment_method || 'Cash';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch the master order details
    const [orders] = await connection.execute(
      'SELECT id, total_amount, paid_amount, due_amount, payment_method FROM orders WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [id, req.tenant_id]
    );
    if (orders.length === 0) {
      const [salesFallback] = await connection.execute(
        'SELECT order_id FROM sales WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [id, req.tenant_id]
      );
      if (salesFallback.length === 0) {
        return res.status(404).json({ error: "Order/Sale record not found" });
      }
      return res.status(400).json({ error: "Settle balance should target the master order ID." });
    }

    const order = orders[0];
    const totalAmount = parseFloat(order.total_amount) || 0;
    const currentPaid = parseFloat(order.paid_amount) || 0;
    const currentDue  = parseFloat(order.due_amount)  || 0;

    // Default to settling the full due balance if no amount is provided
    const settleAmount = paymentAmountInput !== undefined && paymentAmountInput !== null
      ? parseFloat(paymentAmountInput)
      : currentDue;

    if (isNaN(settleAmount) || settleAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Settle amount must be a positive number." });
    }

    // ── Overpayment guard: reject if payment exceeds the remaining due ──
    const remaining_due = order.total_amount - order.paid_amount;
    if (settleAmount > remaining_due) {
      await connection.rollback();
      return res.status(400).json({
        error: `Payment amount (₹${settleAmount}) cannot exceed the remaining due balance (₹${remaining_due}).`
      });
    }

    const newPaidAmount = Math.min(order.total_amount, order.paid_amount + settleAmount);
    const newDueAmount = Math.max(0, order.total_amount - newPaidAmount);
    const newStatus = newDueAmount <= 0 ? 'Paid' : 'Partial';

    // 2. Update the master order record
    await connection.execute(
      `UPDATE orders 
       SET paid_amount = ?, due_amount = ?, payment_status = ?, payment_method = ?
       WHERE id = ? AND tenant_id = ?`,
      [newPaidAmount, newDueAmount, newStatus, paymentMethodInput, id, req.tenant_id]
    );

    // 3. Proportionally update the sales records for ledger consistency
    const [sales] = await connection.execute(
      'SELECT id, total_revenue FROM sales WHERE order_id = ? AND tenant_id = ? FOR UPDATE',
      [id, req.tenant_id]
    );

    for (const sale of sales) {
      const subtotal = parseFloat(sale.total_revenue) || 0;
      const itemRatio = totalAmount > 0 ? (subtotal / totalAmount) : 0;
      const itemPaidAmt = newPaidAmount * itemRatio;
      const itemDueAmt = Math.max(0, subtotal - itemPaidAmt);
      const itemStatus = itemDueAmt <= 0 ? 'Paid' : 'Partial';

      await connection.execute(
        `UPDATE sales 
         SET paid_amount = ?, due_amount = ?, payment_status = ?, payment_method = ?
         WHERE id = ? AND tenant_id = ?`,
         [itemPaidAmt, itemDueAmt, itemStatus, paymentMethodInput, sale.id, req.tenant_id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Balance settled successfully", order: { id, paid_amount: newPaidAmount, due_amount: newDueAmount, payment_status: newStatus } });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

app.post('/api/sales/:id/settle', settleBalanceHandler);
app.put('/api/sales/:id/settle', settleBalanceHandler);
app.patch('/api/sales/:id/settle', settleBalanceHandler);

// SALES: Edit existing sales order entry
app.put('/api/sales/:id', async (req, res) => {
  const { id } = req.params;
  const { buyer_name, contact_number, payment_method, payment_status, transportation_fee, items, total_amount } = req.body;
  const newTransportFee = parseFloat(transportation_fee) || 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch current order details
    const [orders] = await connection.execute(
      'SELECT id, total_amount, transportation_fee, paid_amount, due_amount FROM orders WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [id, req.tenant_id]
    );
    if (orders.length === 0) {
      throw new Error("Order not found");
    }

    const existingOrder = orders[0];
    let orderPaidAmount = parseFloat(existingOrder.paid_amount) || 0;
    let orderDueAmount = parseFloat(existingOrder.due_amount) || 0;

    if (payment_status === 'Paid') {
      orderPaidAmount = parseFloat(total_amount) || 0;
      orderDueAmount = 0;
    } else if (payment_status === 'Unpaid') {
      orderPaidAmount = 0;
      orderDueAmount = parseFloat(total_amount) || 0;
    } else { // 'Partial'
      orderDueAmount = Math.max(0, (parseFloat(total_amount) || 0) - orderPaidAmount);
    }

    // 2. Fetch current sales items for this order to perform stock adjustment comparison
    const [oldSales] = await connection.execute(
      'SELECT id, product_id, quantity_sold FROM sales WHERE order_id = ? AND tenant_id = ? FOR UPDATE',
      [id, req.tenant_id]
    );

    // 3. Compute net stock change for each product
    const netChange = {}; // product_id -> net quantity sold change (new_qty - old_qty)
    for (const sale of oldSales) {
      const pId = sale.product_id;
      netChange[pId] = (netChange[pId] || 0) - parseFloat(sale.quantity_sold);
    }
    for (const item of items || []) {
      const pId = Number(item.product_id);
      netChange[pId] = (netChange[pId] || 0) + parseFloat(item.quantity);
    }

    // 4. Validate and Adjust stock in products table
    for (const pId of Object.keys(netChange)) {
      const change = netChange[pId];
      if (change === 0) continue;

      if (change > 0) {
        // Need to deduct additional stock; verify availability
        const [products] = await connection.execute(
          'SELECT id, name, quantity FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
          [pId, req.tenant_id]
        );
        if (products.length === 0) {
          throw new Error(`Product ID ${pId} not found in inventory.`);
        }
        const prod = products[0];
        if (parseFloat(prod.quantity) < change) {
          throw new Error(`Insufficient stock for "${prod.name}". Additional needed: ${change.toFixed(2)}, Available: ${parseFloat(prod.quantity).toFixed(2)}.`);
        }
      }

      // Update product stock levels
      await connection.execute(
        'UPDATE products SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?',
        [change, pId, req.tenant_id]
      );
    }

    // 5. Update master order record
    await connection.execute(
      `UPDATE orders 
       SET buyer_name = ?, contact_number = ?, payment_method = ?, payment_status = ?, transportation_fee = ?, total_amount = ?, paid_amount = ?, due_amount = ?
       WHERE id = ? AND tenant_id = ?`,
      [buyer_name || null, contact_number || null, payment_method, payment_status, newTransportFee, parseFloat(total_amount) || 0, orderPaidAmount, orderDueAmount, id, req.tenant_id]
    );

    // 6. Delete sales rows that were removed from the order
    const keepSaleIds = (items || []).map(item => item.sale_id).filter(sid => sid !== undefined && sid !== null);
    if (keepSaleIds.length > 0) {
      await connection.execute(
        `DELETE FROM sales WHERE order_id = ? AND tenant_id = ? AND id NOT IN (${keepSaleIds.map(() => '?').join(',')})`,
        [id, req.tenant_id, ...keepSaleIds]
      );
    } else {
      await connection.execute(
        'DELETE FROM sales WHERE order_id = ? AND tenant_id = ?',
        [id, req.tenant_id]
      );
    }

    // 7. Insert new items or update existing items in the sales table
    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      const productId = Number(item.product_id);
      const qty = parseFloat(item.quantity);
      const unitPrice = Number(item.unit_price);
      const subtotal = Number(item.subtotal);
      const unit = item.unit || 'Piece';
      const itemTransportFee = i === 0 ? newTransportFee : 0;
      
      const itemRatio = parseFloat(total_amount) > 0 ? (subtotal / parseFloat(total_amount)) : 0;
      const itemPaidAmt = orderPaidAmount * itemRatio;
      const itemDueAmt = subtotal - itemPaidAmt;

      if (item.sale_id) {
        await connection.execute(
          `UPDATE sales 
           SET product_id = ?, quantity_sold = ?, total_revenue = ?, quantity_unit = ?, payment_method = ?, payment_status = ?, transportation_fee = ?, paid_amount = ?, due_amount = ?
           WHERE id = ? AND order_id = ? AND tenant_id = ?`,
          [productId, qty, subtotal, unit, payment_method, payment_status, itemTransportFee, itemPaidAmt, itemDueAmt, item.sale_id, id, req.tenant_id]
        );
      } else {
        await connection.execute(
          `INSERT INTO sales
             (tenant_id, order_id, product_id, quantity_sold, total_revenue, payment_method, payment_status, transportation_fee, quantity_unit, paid_amount, due_amount, sold_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [req.tenant_id, id, productId, qty, subtotal, payment_method, payment_status, itemTransportFee, unit, itemPaidAmt, itemDueAmt]
        );
      }
    }

    // 8. Retrieve the updated order object
    const [updatedOrders] = await connection.execute(
      'SELECT id, tenant_id, buyer_name, contact_number, payment_method, payment_status, total_amount, transportation_fee, created_at, paid_amount, due_amount FROM orders WHERE id = ? AND tenant_id = ?',
      [id, req.tenant_id]
    );

    await connection.commit();
    res.json({ success: true, message: "Order updated successfully", order: updatedOrders[0] });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

/**
 * 🔄 SALES: Process Partial Item Returns / Refunds
 */
app.post('/api/sales/:id/return', async (req, res) => {
  const { id } = req.params; // master order_id
  const { items, refund_type } = req.body; // array of { product_id, return_quantity }, refund_type

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items declared for return." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch master order
    const [orders] = await connection.execute(
      'SELECT id, total_amount, paid_amount, due_amount, payment_status FROM orders WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [id, req.tenant_id]
    );
    if (orders.length === 0) {
      throw new Error("Order not found.");
    }
    const order = orders[0];

    let totalRefundValue = 0;
    const itemsToProcess = [];

    // 2. Fetch sales items under this order and calculate return valuation
    for (const item of items) {
      const productId = Number(item.product_id);
      const returnQty = parseFloat(item.return_quantity);

      if (isNaN(returnQty) || returnQty <= 0) continue; // skip zero/invalid returns

      const [sales] = await connection.execute(
        'SELECT id, product_id, quantity_sold, quantity_returned, total_revenue, amount_refunded FROM sales WHERE order_id = ? AND product_id = ? AND tenant_id = ? FOR UPDATE',
        [id, productId, req.tenant_id]
      );
      if (sales.length === 0) {
        throw new Error(`Item with product ID ${productId} not found in this order.`);
      }
      const sale = sales[0];
      const originalQty = parseFloat(sale.quantity_sold);
      const returnedQtySoFar = parseFloat(sale.quantity_returned || 0);
      const remainingQty = originalQty - returnedQtySoFar;

      if (returnQty > remainingQty) {
        throw new Error(`Cannot return more than the remaining quantity (${remainingQty}) for product ID ${productId}.`);
      }

      const originalRevenue = parseFloat(sale.total_revenue);
      const unitPrice = originalQty > 0 ? (originalRevenue / originalQty) : 0;
      const refundVal = returnQty * unitPrice;

      totalRefundValue += refundVal;
      itemsToProcess.push({
        sale,
        productId,
        returnQty,
        refundVal
      });
    }

    if (itemsToProcess.length === 0) {
      throw new Error("No items were valid for return.");
    }

    // 3. Increment stock in products table
    for (const processItem of itemsToProcess) {
      await connection.execute(
        'UPDATE products SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?',
        [processItem.returnQty, processItem.productId, req.tenant_id]
      );

      // Update sales row
      const newQtyReturned = parseFloat(processItem.sale.quantity_returned || 0) + processItem.returnQty;
      const newAmountRefunded = parseFloat(processItem.sale.amount_refunded || 0) + processItem.refundVal;

      await connection.execute(
        'UPDATE sales SET quantity_returned = ?, amount_refunded = ? WHERE id = ? AND tenant_id = ?',
        [newQtyReturned, newAmountRefunded, processItem.sale.id, req.tenant_id]
      );

      // Insert return log row
      await connection.execute(
        'INSERT INTO returns (tenant_id, sale_id, quantity_returned, amount_refunded) VALUES (?, ?, ?, ?)',
        [req.tenant_id, processItem.sale.id, processItem.returnQty, processItem.refundVal]
      );
    }

    // 4. Financial Adjustments on Master Order
    let newTotalAmount = Math.max(0, parseFloat(order.total_amount) - totalRefundValue);
    let newPaidAmount = parseFloat(order.paid_amount) || 0;
    let newDueAmount = parseFloat(order.due_amount) || 0;

    if (refund_type === 'deduct_due') {
      const deductFromDue = Math.min(newDueAmount, totalRefundValue);
      newDueAmount = Math.max(0, newDueAmount - deductFromDue);
      const remainingRefund = totalRefundValue - deductFromDue;
      newPaidAmount = Math.max(0, newPaidAmount - remainingRefund);
    } else { // refund_cash
      newPaidAmount = Math.max(0, newPaidAmount - totalRefundValue);
    }

    // Recalculate status based on new due_amount
    let newStatus = order.payment_status;
    if (newDueAmount <= 0) {
      newStatus = 'Paid';
    } else if (newPaidAmount > 0 && newDueAmount > 0) {
      newStatus = 'Partial';
    } else if (newPaidAmount === 0) {
      newStatus = 'Unpaid';
    }

    await connection.execute(
      'UPDATE orders SET total_amount = ?, paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ? AND tenant_id = ?',
      [newTotalAmount, newPaidAmount, newDueAmount, newStatus, id, req.tenant_id]
    );

    // Sync sales status and paid amounts for ledger compatibility
    const [salesAfter] = await connection.execute(
      'SELECT id, total_revenue FROM sales WHERE order_id = ? AND tenant_id = ? FOR UPDATE',
      [id, req.tenant_id]
    );
    for (const sale of salesAfter) {
      const subtotal = parseFloat(sale.total_revenue) || 0;
      const itemRatio = newTotalAmount > 0 ? (subtotal / newTotalAmount) : 0;
      const itemPaidAmt = newPaidAmount * itemRatio;
      const itemDueAmt = Math.max(0, subtotal - itemPaidAmt);
      const itemStatus = itemDueAmt <= 0 ? 'Paid' : 'Partial';

      await connection.execute(
        'UPDATE sales SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ? AND tenant_id = ?',
        [itemPaidAmt, itemDueAmt, itemStatus, sale.id, req.tenant_id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Returns processed successfully" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// ─────────────────────────────────────────────
// 💸 MULTI-TENANT EXPENSES LEDGER ENGINE
// ─────────────────────────────────────────────

// WRITE: Append manual expense debit records
app.post('/api/expenses', async (req, res) => {
  const { title, category, amount, notes } = req.body;

  if (!title || !category || !amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: "Title, categorical map index, and positive numerical pricing amount are required." });
  }

  try {
    await pool.execute(
      'INSERT INTO expenses (tenant_id, title, category, amount, notes) VALUES (?, ?, ?, ?, ?)',
      [req.tenant_id, title, category, Number(amount), notes || null]
    );
    res.status(201).json({ success: true, message: "Expense securely filed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ: Fetch historical localized multi-tenant expense logs
app.get('/api/expenses', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, title, category, amount, notes, spent_at FROM expenses WHERE tenant_id = ? ORDER BY spent_at DESC',
      [req.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Remove an expense entry
app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM expenses WHERE id = ? AND tenant_id = ?', [id, req.tenant_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense record not found' });
    }
    res.json({ success: true, message: 'Expense record deleted successfully', deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log('Trader Core System running smoothly on port 5000'));