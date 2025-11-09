const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { transporter } = require('../config/email');

exports.register = async (req, res) => {
  try {
    const { name, email, password, gender, age, genres } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // For testing: make first user admin
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      gender: ['male','female'].includes(gender) ? gender : 'male',
      age: typeof age === 'number' ? age : undefined,
      preferences: {
        genres: Array.isArray(genres) ? genres.filter(g => typeof g === 'string') : []
      }
    });

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response (don't send password)
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        age: user.age,
        preferences: user.preferences
      }
    });

    // Send email (async, don't wait)
    try {
      await transporter.sendMail({
        to: email,
        subject: 'Welcome to MERNFLIX',
        text: `Hi ${name}! Welcome to MERNFLIX. Your account has been created successfully.`
      });
    } catch (emailErr) {
      console.warn('Email send failed (non-critical):', emailErr.message);
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for:', email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('Invalid password for:', email);
      return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for:', email);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        age: user.age,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error logging in' });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    // ensure gender & age included
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      gender: req.user.gender,
      age: req.user.age,
      subscription: req.user.subscription,
      watchHistory: req.user.watchHistory,
      preferences: req.user.preferences
    });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};
