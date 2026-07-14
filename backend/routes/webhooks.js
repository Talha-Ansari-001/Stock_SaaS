const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_API_KEY || 'sk_test_mock');
const pool = require('../db');

// Stripe webhook endpoint
// Note: This route requires the raw request body to verify the cryptographic signature.
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Safely construct the event and verify its signature
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Fallback for local testing / development without secret verification
      console.warn('⚠️ Stripe Webhook signature verification bypassed. Configured STRIPE_WEBHOOK_SECRET is missing.');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error(`❌ Webhook Signature Verification Failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const subscription = event.data.object;
  const stripeCustomerId = subscription.customer;
  
  console.log(`🔔 Stripe Webhook Received: Event type "${event.type}" for customer "${stripeCustomerId}"`);

  // Handle specific subscription events
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const status = subscription.status; // e.g. active, trialing, past_due, canceled
      // Extract plan tier from price metadata, subscription metadata, or default to premium
      const planTier = subscription.metadata?.plan_tier || 
                       subscription.items?.data[0]?.price?.metadata?.plan_tier || 
                       'premium';

      try {
        const [result] = await pool.execute(
          'UPDATE tenants SET subscription_status = ?, plan_tier = ? WHERE stripe_customer_id = ?',
          [status, planTier, stripeCustomerId]
        );

        if (result.affectedRows === 0) {
          console.warn(`⚠️ Stripe customer "${stripeCustomerId}" does not match any tenant in our system.`);
        } else {
          console.log(`✅ Updated tenant subscription to "${status}" (Plan: ${planTier}) for customer "${stripeCustomerId}"`);
        }
      } catch (err) {
        console.error('Failed to update tenant subscription on update event:', err);
        return res.status(500).json({ error: 'Database update failed' });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      try {
        const [result] = await pool.execute(
          'UPDATE tenants SET subscription_status = ?, plan_tier = ? WHERE stripe_customer_id = ?',
          ['canceled', 'free', stripeCustomerId]
        );

        if (result.affectedRows === 0) {
          console.warn(`⚠️ Stripe customer "${stripeCustomerId}" does not match any tenant in our system.`);
        } else {
          console.log(`✅ Subscription deleted: Tenant updated to "canceled" (Plan: free) for customer "${stripeCustomerId}"`);
        }
      } catch (err) {
        console.error('Failed to update tenant subscription on delete event:', err);
        return res.status(500).json({ error: 'Database update failed' });
      }
      break;
    }

    default:
      console.log(`ℹ️ Unhandled Stripe Webhook Event: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

module.exports = router;
