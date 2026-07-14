const pool = require('../db');

/**
 * Subscription Gating Middleware
 * Evaluates tenant subscription status for write operations (POST, PUT, DELETE, PATCH).
 * Rejects with 402 Payment Required if status is not 'active' or 'trialing'.
 */
const subscriptionCheck = async (req, res, next) => {
  const tenantId = req.tenant_id;

  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context is missing from request' });
  }

  // Define write methods to gate
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  try {
    // Query tenant subscription details from database
    const [tenants] = await pool.query(
      'SELECT subscription_status, plan_tier FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (tenants.length === 0) {
      return res.status(404).json({ error: 'Tenant record not found' });
    }

    const tenant = tenants[0];
    
    // Attach subscription details to request context for downstream routes
    req.subscription_status = tenant.subscription_status;
    req.plan_tier = tenant.plan_tier;

    // Gate write requests if subscription is inactive
    if (isWriteMethod) {
      const activeStatuses = ['active', 'trialing', 'trailing'];
      const currentStatus = (tenant.subscription_status || '').toLowerCase();

      if (!activeStatuses.includes(currentStatus)) {
        return res.status(402).json({
          error: 'Payment Required',
          message: `Action blocked. Your subscription status is "${tenant.subscription_status}". Please update your billing details to resume catalog edits and transactions.`
        });
      }
    }

    next();
  } catch (error) {
    console.error('Subscription check middleware error:', error);
    res.status(500).json({ error: 'Internal server error validating subscription level' });
  }
};

module.exports = subscriptionCheck;
