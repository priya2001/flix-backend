const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const { transporter } = require('../config/email');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// create a one-time order for subscription initial payment
exports.createSubscription = async (req, res) => {
  try {
    const { plan } = req.body;
    
    console.log('=== Subscription Request ===');
    console.log('Plan:', plan);
    console.log('User:', req.user?._id);
    console.log('Razorpay Key ID:', process.env.RAZORPAY_KEY_ID);
    console.log('Razorpay Secret exists:', !!process.env.RAZORPAY_KEY_SECRET);
    
    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials missing!');
      return res.status(500).json({ message: 'Payment gateway not configured' });
    }

    const amount = plan === 'yearly' ? 10 * 100 : 1 * 100;

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
      notes: { plan, user_id: req.user?._id?.toString() || 'unknown' }
    });
    
    console.log('Order created successfully:', order.id);
    
    return res.json({ order, amount });
  } catch (err) {
    // In test/dev mode allow returning a mock order so the frontend can continue
    if (process.env.SKIP_PAYMENT === 'true') {
      const mock = { id: 'order_mock_' + Date.now() };
      return res.json({ order: mock, amount: req.body.plan === 'yearly' ? 10 * 100 : 1 * 100, mock: true });
    }
    console.error('createSubscription error:', err);
    return res.status(500).json({ message: 'Failed to create order', error: err.message });
  }
};

// verify payment and activate subscription on user
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    // Skip signature verification in test mode
    if (process.env.SKIP_PAYMENT === 'true') {
      const now = new Date();
      const endDate = new Date(now);
      if (plan === 'yearly') endDate.setFullYear(now.getFullYear() + 1);
      else endDate.setMonth(now.getMonth() + 1);

      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          'subscription.plan': plan || 'monthly',
          'subscription.startDate': now,
          'subscription.endDate': endDate,
          'subscription.status': 'active'
        },
        { new: true }
      );
      return res.json({ success: true, user, skipped: true });
    }

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Update user subscription
    const userId = req.user._id;
    const now = new Date();
    const endDate = new Date(now);
    if (plan === 'yearly') endDate.setFullYear(now.getFullYear() + 1);
    else endDate.setMonth(now.getMonth() + 1);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'subscription.plan': plan || 'monthly',
        'subscription.startDate': now,
        'subscription.endDate': endDate,
        'subscription.status': 'active'
      },
      { new: true }
    );

    // Send confirmation email
    try {
      await transporter.sendMail({
        to: user.email,
        subject: 'Subscription activated — MERNFLIX',
        text: `Hi ${user.name}, your ${plan} subscription is now active until ${endDate.toISOString()}.`
      });
    } catch (e) {
      console.warn('Email send failed:', e.message || e);
    }

    return res.json({ success: true, user });
  } catch (err) {
    console.error('verifyPayment error:', err);
    return res.status(500).json({ message: 'Payment verification failed' });
  }
};

// cancel subscription (admin or user)
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findByIdAndUpdate(userId, {
      'subscription.status': 'inactive',
      'subscription.endDate': new Date()
    }, { new: true });

    try {
      await transporter.sendMail({
        to: user.email,
        subject: 'Subscription cancelled — MERNFLIX',
        text: `Hi ${user.name}, your subscription has been cancelled. You will retain access until ${user.subscription.endDate}.`
      });
    } catch (e) {
      console.warn('Email send failed:', e.message || e);
    }

    return res.json({ success: true, user });
  } catch (err) {
    console.error('cancelSubscription error:', err);
    return res.status(500).json({ message: 'Failed to cancel subscription' });
  }
};

// Test/dev: directly activate subscription without payment (requires SKIP_PAYMENT=true)
exports.mockActivate = async (req, res) => {
  try {
    if (process.env.SKIP_PAYMENT !== 'true') {
      return res.status(403).json({ message: 'Mock activation disabled' });
    }
    const plan = ['monthly', 'yearly'].includes(req.body.plan) ? req.body.plan : 'monthly';
    const now = new Date();
    const endDate = new Date(now);
    if (plan === 'yearly') endDate.setFullYear(now.getFullYear() + 1);
    else endDate.setMonth(now.getMonth() + 1);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'subscription.plan': plan,
        'subscription.startDate': now,
        'subscription.endDate': endDate,
        'subscription.status': 'active'
      },
      { new: true }
    );

    return res.json({ success: true, user, mockActivated: true });
  } catch (err) {
    console.error('mockActivate error:', err);
    return res.status(500).json({ message: 'Failed to mock activate subscription' });
  }
};
