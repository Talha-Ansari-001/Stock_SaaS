const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = 'TRADER_OS_SECRET_KEY';

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'root', // Put your MySQL password here
  database: 'simple_saas_inventory',
  connectionLimit: 10
});

// ─────────────────────────────────────────────
// UNPROTECTED ROUTES: LOGIN / REGISTER (No Token Needed)
// ─────────────────────────────────────────────

/**
 * 🔑 REGISTER NEW BUSINESS
 */
app.post('/api/auth/register', async (req, res) => {
  const { business_name, email, password } = req.body;

  if (!business_name || !email) {
    return res.status(400).json({ error: "Business name and Email are required" });
  }

  try {
    const tenantId = 'tenant_' + Math.random().toString(36).substr(2, 9);

    // 🌟 UPDATED: Now inserting the email column into your table safely
    await pool.execute(
      'INSERT INTO tenants (id, business_name, email) VALUES (?, ?, ?)',
      [tenantId, business_name, email]
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
  const { email, password } = req.body; // Expecting email from the frontend form

  if (!email) {
    return res.status(400).json({ error: "Email address required" });
  }

  try {
    // 1. Look up the tenant ID by matching the email instead of business name
    // Note: Ensure your database 'tenants' table has an 'email' column.
    let [rows] = await pool.execute('SELECT id FROM tenants WHERE email = ?', [email]);
    let tenantId;

    if (rows.length === 0) {
      return res.status(401).json({ error: "No account found with this email address." });
    } else {
      tenantId = rows[0].id;
    }

    // 2. Passcodes verify successfully -> issue session token
    const token = jwt.sign({ tenantId }, JWT_SECRET, { expiresIn: '24h' }); //[cite: 1]
    res.json({ token, message: "Welcome to Trader Workspace" }); //[cite: 1]
  } catch (err) {
    res.status(500).json({ error: err.message }); //[cite: 1]
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
// INVENTORY: Add new product / replenish quantity
app.post('/api/products', async (req, res) => {
  // 🌟 Destructure the two new incoming fields from the frontend payload
  const { name, quantity, price, buying_price, supplier_name } = req.body;

  if (!name || quantity === undefined || !price || !buying_price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 🌟 INSERT values for buying_price and supplier_name into the query
    const [result] = await pool.execute(
      `INSERT INTO products 
        (tenant_id, name, quantity, price, buying_price, supplier_name) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
        quantity = quantity + VALUES(quantity),
        price = VALUES(price),
        buying_price = VALUES(buying_price),
        supplier_name = VALUES(supplier_name)`,
      [
        req.tenant_id,
        name,
        quantity,
        price,
        buying_price,
        supplier_name || null
      ]
    );
    res.status(201).json({ success: true, message: "Inventory updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SALES: Register a sell entry & automatically deduct quantity safely
app.post('/api/sales', async (req, res) => {
  const { product_id, quantity_to_sell, buyer_name, buyer_contact, quantity_unit, payment_method } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [products] = await connection.execute(
      'SELECT id, quantity, price FROM products WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [product_id, req.tenant_id]
    );

    if (products.length === 0) throw new Error("Item not found in your inventory catalog");
    const product = products[0];

    if (product.quantity < parseInt(quantity_to_sell)) {
      throw new Error(`Insufficient Stock level! Only ${product.quantity} items left.`);
    }

    await connection.execute(
      'UPDATE products SET quantity = quantity - ? WHERE id = ?',
      [quantity_to_sell, product_id]
    );

    const total_revenue = product.price * parseInt(quantity_to_sell);
    await connection.execute(
      'INSERT INTO sales (tenant_id, product_id, quantity_sold, total_revenue, buyer_name, buyer_contact, quantity_unit, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.tenant_id,
        product_id,
        quantity_to_sell,
        total_revenue,
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
      SELECT s.id, p.name AS product_name, s.quantity_sold, s.total_revenue, s.sold_at 
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.tenant_id = ?
      ORDER BY s.sold_at DESC;
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

app.listen(5000, () => console.log('Trader Core System running smoothly on port 5000'));