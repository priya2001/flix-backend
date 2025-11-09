const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.post('/create-subscription', auth, paymentController.createSubscription);
router.post('/verify', auth, paymentController.verifyPayment);
router.post('/cancel', auth, paymentController.cancelSubscription);

// Test endpoint to verify Razorpay config
router.get('/test-razorpay', (req, res) => {
  const Razorpay = require('razorpay');
  try {
    const rz = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    res.json({ 
      success: true, 
      key_id: process.env.RAZORPAY_KEY_ID,
      configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test/dev: mock activate subscription without payment (requires SKIP_PAYMENT=true)
router.post('/mock-activate', auth, paymentController.mockActivate);

module.exports = router;
