const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  login,
  logout,
  getProfile,
  updateProfile
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth routes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for general routes
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});

// Public routes (with rate limiting)
router.post('/register',
  authLimiter,
  validateRegister,
  handleValidationErrors,
  register
);

router.post('/login',
  authLimiter,
  validateLogin,
  handleValidationErrors,
  login
);

// Protected routes
router.post('/logout',
  generalLimiter,
  authenticate,
  logout
);

router.get('/profile',
  generalLimiter,
  authenticate,
  getProfile
);

router.put('/profile',
  generalLimiter,
  authenticate,
  validateProfileUpdate,
  handleValidationErrors,
  updateProfile
);

// Health check for auth system
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth system is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;