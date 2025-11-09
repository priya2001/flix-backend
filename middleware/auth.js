const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
    }

    // Try to fetch user
    let user;
    try {
      user = await User.findById(decoded.userId).select('-password');
    } catch (dbErr) {
      console.error('Database error while fetching user:', dbErr.message);
      return res.status(500).json({ message: 'Database connection error. Please try again.' });
    }

    if (!user) {
      console.log('User not found for token:', decoded.userId);
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ message: 'Unauthorized: Authentication failed' });
  }
};
