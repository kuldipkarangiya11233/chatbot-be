const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModel.js');
const dotenv = require('dotenv');

dotenv.config();

const protect = asyncHandler(async (req, res, next) => {
  let token;

  console.log('Auth Headers:', req.headers); // Debug log

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Token received:', token); // Debug log

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded); // Debug log

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');
      console.log('User found:', req.user ? 'Yes' : 'No'); // Debug log

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user not found'
        });
      }

      next();
    } catch (error) {
      console.error('Token verification error:', error); // Debug log
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid token'
      });
    }
  } else {
    console.log('No Bearer token in headers'); // Debug log
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }
});

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, please login'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

module.exports = { protect, authorize };