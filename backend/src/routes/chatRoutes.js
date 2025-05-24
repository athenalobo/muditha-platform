const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  createChatRoom,
  getUserChatRooms,
  getChatRoom,
  getChatRoomMessages,
  sendMessage,  // ADD THIS LINE
  joinChatRoom,
  leaveChatRoom
} = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Rate limiting for chat routes
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 chat requests per windowMs
  message: {
    success: false,
    message: 'Too many chat requests, please try again later'
  }
});

// Apply authentication to all chat routes
router.use(authenticate);
router.use(chatLimiter);

// Chat room routes
router.post('/rooms', createChatRoom);
router.get('/rooms', getUserChatRooms);
router.get('/rooms/:roomId', getChatRoom);
router.get('/rooms/:roomId/messages', getChatRoomMessages);
router.post('/rooms/:roomId/messages', sendMessage); // ADD THIS LINE
router.post('/rooms/:roomId/join', joinChatRoom);
router.post('/rooms/:roomId/leave', leaveChatRoom);

// Health check for chat system
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Chat system is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;