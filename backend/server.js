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
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'simple_saas_inventory',
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
  // Catch for some mysql2 wrapper objects
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

    // 🌟 FIXED: Stores the password signature safely into the DB columns
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
    // 🌟 FIXED: Fetch both the id and the stored hashed password string
    let [rows] = await pool.execute('SELECT id, password FROM tenants WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ error: "No account found with this email address." });
    }

    const tenant = rows[0];

    // ⚡ FIXED: Verify that the raw password matches the database hash safely
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

// Express applies this to all paths registered below this exact call point
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
  const { name, quantity, price, buying_price, kg_per_unit, supplier_name } = req.body;

  if (!name || quantity === undefined || !price || !buying_price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const [existing] = await pool.execute('SELECT id FROM products WHERE name = ? AND tenant_id = ?', [name, req.tenant_id]);
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE products SET quantity = quantity + ?, price = ?, buying_price = ?, kg_per_unit = ?, supplier_name = ? WHERE id = ? AND tenant_id = ?',
        [Number(quantity), Number(price), Number(buying_price), Number(kg_per_unit || 1.00), supplier_name || null, existing[0].id, req.tenant_id]
      );
    } else {
      await pool.execute(
        'INSERT INTO products (tenant_id, name, quantity, price, buying_price, kg_per_unit, supplier_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.tenant_id, name, Number(quantity), Number(price), Number(buying_price), Number(kg_per_unit || 1.00), supplier_name || null]
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

    // ⚡ FRACTIONAL WEIGHT CONVERSION ENGINE
    if (quantity_unit === 'Kg') {
      unitsToDeduct = inputQty / kgPerUnit;
      total_revenue = (parseFloat(product.price) / kgPerUnit) * inputQty;
    } else {
      unitsToDeduct = inputQty;
      total_revenue = parseFloat(product.price) * inputQty;
    }

    if (product.quantity < unitsToDeduct) {
      const availableKg = (product.quantity * kgPerUnit).toFixed(1);
      throw new Error(`Insufficient Stock level! Only ${Number(product.quantity).toFixed(2)} Bags (${availableKg} Kg) left.`);
    }

    // Deduct stock balance (supports decimal values cleanly!)
    await connection.execute(
      'UPDATE products SET quantity = quantity - ? WHERE id = ? AND tenant_id = ?',
      [unitsToDeduct, product_id, req.tenant_id]
    );

    const finalAmountPaid = amount_paid !== undefined && amount_paid !== null ? parseFloat(amount_paid) : total_revenue;

    await connection.execute(
      'INSERT INTO sales (tenant_id, product_id, quantity_sold, total_revenue, amount_paid, buyer_name, buyer_contact, quantity_unit, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.tenant_id,
        product_id,
        inputQty, 
        total_revenue,
        finalAmountPaid,
        buyer_name || null,
        buyer_contact || null,
        quantity_unit || 'Kg',
        payment_method || 'Cash'
      ]
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

// REPORTS: View sales ledger history with timestamp details
app.get('/api/sales/history', async (req, res) => {
  try {
    const query = `
      SELECT s.id, p.name AS product_name, s.product_id, s.quantity_sold, s.total_revenue, s.amount_paid,
             s.quantity_returned, s.amount_refunded, p.kg_per_unit, s.buyer_name, s.buyer_contact, s.quantity_unit, s.payment_method, s.sold_at 
      FROM sales s
      JOIN products p ON s.product_id = p.id AND p.tenant_id = ?
      WHERE s.tenant_id = ?
      ORDER BY s.sold_at DESC;
    `;
    const [rows] = await pool.execute(query, [req.tenant_id, req.tenant_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INVENTORY: Delete specific item row cleanly
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute(
      'DELETE FROM products WHERE id = ? AND tenant_id = ?',
      [id, req.tenant_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Item row manifest not found" });
    }

    res.json({ success: true, message: "Inventory record permanently purged." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES: Update a partial/credit transaction to fully paid
app.put('/api/sales/:id/complete', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute('SELECT total_revenue FROM sales WHERE id = ? AND tenant_id = ?', [id, req.tenant_id]);
    if (rows.length === 0) return res.status(404).json({ error: "Transaction record not found." });

    const total = rows[0].total_revenue;

    const [result] = await pool.execute(
      'UPDATE sales SET amount_paid = ?, payment_method = "Cash" WHERE id = ? AND tenant_id = ?',
      [total, id, req.tenant_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Transaction record not found." });
    }

    res.json({ success: true, message: "Ledger entry updated to fully completed." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES: Clear outstanding debt balance
app.patch('/api/sales/:id/settle', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT total_revenue FROM sales WHERE id = ? AND tenant_id = ?', [id, req.tenant_id]);
    if (rows.length === 0) return res.status(404).json({ error: "Record not found" });

    const total = rows[0].total_revenue;

    await pool.execute(
      'UPDATE sales SET amount_paid = ?, payment_method = "Cash (Settled)" WHERE id = ? AND tenant_id = ?',
      [total, id, req.tenant_id]
    );

    res.json({ success: true, message: "Balance settled successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔄 SALES: Process Partial Item Returns / Refunds
 */
app.post('/api/sales/:id/return', async (req, res) => {
  const { id } = req.params;
  const { returned_quantity, refund_cash, quantity_unit } = req.body;

  if (!returned_quantity || parseFloat(returned_quantity) <= 0) {
    return res.status(400).json({ error: "A valid return volume metric must be declared." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [sales] = await connection.execute(
      'SELECT product_id, quantity_sold, total_revenue, amount_paid, quantity_returned, amount_refunded, quantity_unit, payment_method FROM sales WHERE id = ? AND tenant_id = ? FOR UPDATE', 
      [Number(id), req.tenant_id]
    );
    if (sales.length === 0) throw new Error("Transaction record not found within your tenant ecosystem.");
    
    const sale = sales[0];
    const originalQty = parseFloat(sale.quantity_sold);
    const returnedQtySoFar = parseFloat(sale.quantity_returned || 0);
    const originalRevenue = parseFloat(sale.total_revenue);
    const amountPaid = parseFloat(sale.amount_paid);
    const amountRefundedSoFar = parseFloat(sale.amount_refunded || 0);
    
    const [products] = await connection.execute(
      'SELECT id, quantity, kg_per_unit FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [Number(sale.product_id), req.tenant_id]
    );
    if (products.length === 0) throw new Error("Parent catalog item structure no longer exists.");
    
    const product = products[0];
    const kgPerUnit = parseFloat(product.kg_per_unit) || 1.00;

    const inputQty = parseFloat(returned_quantity);
    let qtyToCompare = 0; 
    let stockToRestore = 0; 

    if (sale.quantity_unit === 'Kg') {
      if (quantity_unit === 'Kg') {
        qtyToCompare = inputQty;
        stockToRestore = inputQty / kgPerUnit;
      } else {
        qtyToCompare = inputQty * kgPerUnit;
        stockToRestore = inputQty;
      }
    } else { 
      if (quantity_unit === 'Bags') {
        qtyToCompare = inputQty;
        stockToRestore = inputQty;
      } else {
        qtyToCompare = inputQty / kgPerUnit;
        stockToRestore = inputQty / kgPerUnit;
      }
    }

    const remainingReturnable = originalQty - returnedQtySoFar;
    if (qtyToCompare > remainingReturnable) {
      throw new Error(`Invalid request. Max returnable volume is ${remainingReturnable.toFixed(2)} ${sale.quantity_unit}`);
    }

    await connection.execute(
      'UPDATE products SET quantity = quantity + ? WHERE id = ? AND tenant_id = ?',
      [Number(stockToRestore), Number(sale.product_id), req.tenant_id]
    );

    const valuePerUnit = originalRevenue / originalQty;
    const returnedValuation = valuePerUnit * qtyToCompare;

    const currentOutstanding = originalRevenue - amountPaid - amountRefundedSoFar;
    
    let refundCashAmount = 0;
    let newAmountPaid = amountPaid;

    if (refund_cash) {
      refundCashAmount = returnedValuation;
      newAmountPaid = Math.max(0, amountPaid - returnedValuation);
    } else {
      if (currentOutstanding >= returnedValuation) {
        refundCashAmount = 0;
      } else {
        refundCashAmount = returnedValuation - currentOutstanding;
        newAmountPaid = Math.max(0, amountPaid - refundCashAmount);
      }
    }

    let newPaymentMethod = sale.payment_method;
    const finalQuantityReturned = returnedQtySoFar + qtyToCompare;
    const finalAmountRefunded = amountRefundedSoFar + returnedValuation;
    const netRevenue = originalRevenue - finalAmountRefunded;

    if (finalQuantityReturned >= originalQty) {
      newPaymentMethod = "Returned";
    } else if (newAmountPaid === 0) {
      newPaymentMethod = "Credit";
    } else if (newAmountPaid < netRevenue) {
      if (!newPaymentMethod.toLowerCase().includes('partial')) {
        newPaymentMethod = `Partial (${newPaymentMethod})`;
      }
    } else {
      newPaymentMethod = "Cash";
    }

    await connection.execute(
      'UPDATE sales SET quantity_returned = ?, amount_refunded = ?, amount_paid = ?, payment_method = ? WHERE id = ? AND tenant_id = ?',
      [Number(finalQuantityReturned), Number(finalAmountRefunded), Number(newAmountPaid), newPaymentMethod, Number(id), req.tenant_id]
    );

    await connection.execute(
      `CREATE TABLE IF NOT EXISTS returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        sale_id INT NOT NULL,
        quantity_returned DECIMAL(10, 2) NOT NULL,
        amount_refunded DECIMAL(10, 2) NOT NULL,
        returned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await connection.execute(
      'INSERT INTO returns (tenant_id, sale_id, quantity_returned, amount_refunded) VALUES (?, ?, ?, ?)',
      [req.tenant_id, Number(id), Number(qtyToCompare), Number(returnedValuation)]
    );

    await connection.commit();
    res.json({ 
      success: true, 
      message: "Return processed successfully.",
      refundCashAmount: refundCashAmount,
      newOutstandingDue: Math.max(0, netRevenue - newAmountPaid)
    });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.listen(5000, () => console.log('Trader Core System running smoothly on port 5000'));